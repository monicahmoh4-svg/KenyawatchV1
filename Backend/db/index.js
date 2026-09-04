const { Pool } = require('pg');
const { COUNTIES, SECTORS } = require('../data/counties');
const { scoreContract } = require('../utils/riskEngine');
const { documentedContracts, documentedGhostProjects } = require('../data/documentedCases');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on('error', (err) => console.error('⚠️ DB Pool Error:', err.message));

// ── Step 1: base tables only — NO indexes here. ──────────────────────────────
// CREATE TABLE IF NOT EXISTS silently no-ops when the table already exists
// (e.g. a database reused from an earlier deploy with an older schema). If we
// bundled CREATE INDEX statements on new columns (like "year") into this same
// batch, and the table pre-existed without those columns, the index creation
// would fail — and because node-pg runs a multi-statement string as one
// implicit transaction, that single failure used to roll back / abort the
// *entire* batch, which skipped column migration AND seeding. Splitting
// table creation, column migration, and indexing into separate, independently
// error-handled steps (below) fixes that for good.
const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    contract_id VARCHAR(120) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    county VARCHAR(100),
    sector VARCHAR(100),
    value BIGINT DEFAULT 0,
    supplier VARCHAR(300),
    supplier_reg_date DATE,
    bid_type VARCHAR(50) DEFAULT 'open',
    awarded_date DATE,
    year INTEGER,
    risk_score INTEGER DEFAULT 0,
    risk_level VARCHAR(10) DEFAULT 'LOW',
    flags JSONB DEFAULT '[]',
    status VARCHAR(30) DEFAULT 'active',
    procuring_entity VARCHAR(300),
    ocds_ocid VARCHAR(120),
    data_type VARCHAR(20) DEFAULT 'reference',
    source_name VARCHAR(300),
    source_url TEXT,
    notes TEXT,
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY, case_number VARCHAR(25) UNIQUE NOT NULL, type VARCHAR(120) NOT NULL,
    county VARCHAR(100), sector VARCHAR(100), description TEXT NOT NULL, amount BIGINT,
    anonymous BOOLEAN DEFAULT true, status VARCHAR(30) DEFAULT 'pending', ai_credibility_score INTEGER DEFAULT 50,
    routing VARCHAR(20) DEFAULT 'EACC', keywords JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ghost_projects (
    id SERIAL PRIMARY KEY, contract_ref VARCHAR(120), project_name VARCHAR(300) NOT NULL,
    county VARCHAR(100), sector VARCHAR(100), claimed_status VARCHAR(200), satellite_status VARCHAR(200),
    amount_at_risk BIGINT DEFAULT 0, detection_status VARCHAR(20) DEFAULT 'flagged', confidence_score INTEGER DEFAULT 0,
    latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, satellite_image_url TEXT,
    data_type VARCHAR(20) DEFAULT 'reference', source_name VARCHAR(300), source_url TEXT,
    last_satellite_check TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ocds_sync_log (
    id SERIAL PRIMARY KEY, year INTEGER, county VARCHAR(100), status VARCHAR(20) DEFAULT 'pending', records INTEGER DEFAULT 0,
    error_msg TEXT, started_at TIMESTAMPTZ DEFAULT NOW(), finished_at TIMESTAMPTZ
  );
`;

// ── Step 2: add any columns a pre-existing (older) table might be missing. ──
// Each statement runs and is checked independently, so one being a no-op (or
// even failing) never blocks the others.
const COLUMN_MIGRATIONS = [
  "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS year INTEGER",
  "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS data_type VARCHAR(20) DEFAULT 'reference'",
  "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS source_name VARCHAR(300)",
  "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS source_url TEXT",
  "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notes TEXT",
  "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS procuring_entity VARCHAR(300)",
  "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS ocds_ocid VARCHAR(120)",
  "ALTER TABLE ghost_projects ADD COLUMN IF NOT EXISTS data_type VARCHAR(20) DEFAULT 'reference'",
  "ALTER TABLE ghost_projects ADD COLUMN IF NOT EXISTS source_name VARCHAR(300)",
  "ALTER TABLE ghost_projects ADD COLUMN IF NOT EXISTS source_url TEXT",
  "ALTER TABLE ghost_projects ADD COLUMN IF NOT EXISTS last_satellite_check TIMESTAMPTZ",
  "ALTER TABLE ocds_sync_log ADD COLUMN IF NOT EXISTS county VARCHAR(100)",
];

// This one must run AFTER the "year" column migration above, and is kept
// separate since it's a data backfill, not a schema change.
const BACKFILL_YEAR_SQL =
  "UPDATE contracts SET year = EXTRACT(YEAR FROM awarded_date)::INT WHERE year IS NULL AND awarded_date IS NOT NULL";

// ── Step 3: indexes — only run once every column above is guaranteed to exist.
const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_contracts_county ON contracts(county)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_year ON contracts(year)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_sector ON contracts(sector)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_risk ON contracts(risk_level)',
  'CREATE INDEX IF NOT EXISTS idx_contracts_data_type ON contracts(data_type)',
];

// Runs a list of independent SQL statements, logging (but never throwing on)
// any individual failure, so a problem with one statement can never abort
// the ones after it or the seeding step that follows.
async function runStatements(client, statements, label) {
  for (const sql of statements) {
    try {
      await client.query(sql);
    } catch (e) {
      console.warn(`⚠️ ${label} statement failed (continuing): ${e.message}\n   SQL: ${sql.slice(0, 120)}`);
    }
  }
}

function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr, i) { return arr[i % arr.length]; }

// Generates 3 realistic *reference* contracts per county (one per broad risk
// band) so every county/year combination in the UI has something to show
// before a live OCDS sync is run. These are clearly flagged data_type =
// 'reference' everywhere in the API and UI — never presented as verified.
function buildReferenceContracts() {
  const years = [2021, 2022, 2023, 2024, 2025, 2026];
  const out = [];

  COUNTIES.forEach((county, ci) => {
    const profiles = [
      { bid_type: 'single_source', regGapMonths: 2, sectorOffset: 0, valueRange: [180_000_000, 620_000_000] },
      { bid_type: 'restricted', regGapMonths: 18, sectorOffset: 1, valueRange: [40_000_000, 150_000_000] },
      { bid_type: 'open', regGapMonths: 60, sectorOffset: 2, valueRange: [3_000_000, 45_000_000] },
    ];

    profiles.forEach((p, pi) => {
      const sector = pick(SECTORS, ci + p.sectorOffset);
      const year = pick(years, ci + pi);
      const awardMonth = String(randomBetween(1, 12)).padStart(2, '0');
      const awardDay = String(randomBetween(1, 27)).padStart(2, '0');
      const awarded_date = `${year}-${awardMonth}-${awardDay}`;
      const regDate = new Date(year, randomBetween(0, 11) - p.regGapMonths, 1);
      const supplier_reg_date = regDate.toISOString().slice(0, 10);
      const value = randomBetween(p.valueRange[0], p.valueRange[1]);
      const contract_id = `KE-${county.code}-${year}-${String(pi + 1).padStart(3, '0')}`;
      const description = `${sector} project — ${['construction', 'rehabilitation', 'supply and delivery', 'expansion'][pi % 4]} in ${county.name} County`;
      const procuring_entity = pi === 2 ? `Ministry of ${sector.split(' ')[0]}` : `${county.name} County Government`;
      const supplier = pi === 0
        ? `${county.name} Regional Contractors Ltd`
        : pi === 1
          ? `${sector.split(' ')[0]} Works (K) Ltd`
          : `National ${sector.split(' ')[0]} Suppliers Co-op`;

      const { risk_score, risk_level, flags } = scoreContract({
        bid_type: p.bid_type, value, description, supplier_reg_date, awarded_date,
      });

      out.push({
        contract_id, description, county: county.name, sector, value, supplier,
        supplier_reg_date, bid_type: p.bid_type, awarded_date, year,
        risk_score, risk_level, flags, procuring_entity,
        data_type: 'reference', source: 'seed',
      });
    });
  });

  return out;
}

async function seedContracts(client) {
  const rows = [...documentedContracts.map(c => ({
    ...c,
    year: c.awarded_date ? new Date(c.awarded_date).getFullYear() : null,
    supplier_reg_date: null,
    ...scoreContract({ bid_type: c.bid_type, value: c.value, description: c.description }),
    source: 'documented',
  })), ...buildReferenceContracts()];

  let inserted = 0;
  for (const r of rows) {
    try {
      await client.query(
        `INSERT INTO contracts
          (contract_id, description, county, sector, value, supplier, supplier_reg_date, bid_type, awarded_date, year,
           risk_score, risk_level, flags, status, procuring_entity, data_type, source_name, source_url, notes, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (contract_id) DO NOTHING`,
        [r.contract_id, r.description, r.county, r.sector, r.value, r.supplier, r.supplier_reg_date || null,
          r.bid_type, r.awarded_date || null, r.year, r.risk_score, r.risk_level, JSON.stringify(r.flags),
          r.status || 'active', r.procuring_entity || null, r.data_type, r.source_name || null,
          r.source_url || null, r.notes || null, r.source]
      );
      inserted++;
    } catch (e) {
      console.warn(`⚠️ Skipped seed row ${r.contract_id}: ${e.message}`);
    }
  }
  return inserted;
}

async function seedGhostProjects(client) {
  let inserted = 0;
  for (const g of documentedGhostProjects) {
    try {
      await client.query(
        `INSERT INTO ghost_projects
          (contract_ref, project_name, county, sector, claimed_status, satellite_status, amount_at_risk,
           detection_status, confidence_score, latitude, longitude, data_type, source_name, source_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [g.contract_ref, g.project_name, g.county, g.sector, g.claimed_status, g.satellite_status,
          g.amount_at_risk, g.detection_status, g.confidence_score, g.latitude, g.longitude,
          g.data_type, g.source_name, g.source_url]
      );
      inserted++;
    } catch (e) {
      console.warn(`⚠️ Skipped ghost project ${g.project_name}: ${e.message}`);
    }
  }
  return inserted;
}

const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');

    // Step 1: tables (no indexes yet).
    await client.query(CREATE_TABLES_SQL);

    // Step 2: migrate any pre-existing table up to the current column set.
    await runStatements(client, COLUMN_MIGRATIONS, 'Column migration');
    await runStatements(client, [BACKFILL_YEAR_SQL], 'Year backfill');

    // Step 3: indexes — safe now that every column above is guaranteed to exist.
    await runStatements(client, CREATE_INDEXES, 'Index creation');

    // Step 4: seed only if empty — always attempted, regardless of whether
    // any non-fatal warnings were logged above.
    const { rowCount: hasContracts } = await client.query('SELECT 1 FROM contracts LIMIT 1');
    if (!hasContracts) {
      console.log('🌱 Seeding contracts (documented cases + 47-county reference set)...');
      const n = await seedContracts(client);
      console.log(`✅ Seeded ${n} contracts.`);
    } else {
      console.log('ℹ️ Contracts table already has data — skipping seed.');
    }

    const { rowCount: hasGhosts } = await client.query('SELECT 1 FROM ghost_projects LIMIT 1');
    if (!hasGhosts) {
      console.log('🌱 Seeding ghost projects...');
      const n = await seedGhostProjects(client);
      console.log(`✅ Seeded ${n} ghost projects.`);
    } else {
      console.log('ℹ️ Ghost projects table already has data — skipping seed.');
    }

    console.log('✅ Database initialization complete.');
  } catch (err) {
    console.error('❌ DB Init Error:', err.message);
    throw err; // let the caller know init genuinely failed, instead of masking it
  } finally {
    if (client) client.release();
  }
};

// Wipes ONLY the contracts and ghost_projects tables (never touches citizen
// reports) and re-runs the full seed from scratch. Used by the protected
// POST /api/admin/reseed endpoint — e.g. to recover from a database that
// partially seeded during an earlier broken deploy and is now stuck with
// stale/incomplete rows that "seed only if empty" won't touch.
async function resetAndReseed() {
  let client;
  try {
    client = await pool.connect();

    // Make sure schema/columns are current before we reseed into them.
    await client.query(CREATE_TABLES_SQL);
    await runStatements(client, COLUMN_MIGRATIONS, 'Column migration');
    await runStatements(client, CREATE_INDEXES, 'Index creation');

    console.log('🗑️ Truncating contracts and ghost_projects for reseed...');
    await client.query('TRUNCATE TABLE contracts RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE ghost_projects RESTART IDENTITY CASCADE');

    const contractsCount = await seedContracts(client);
    const ghostsCount = await seedGhostProjects(client);

    console.log(`✅ Reseed complete: ${contractsCount} contracts, ${ghostsCount} ghost projects.`);
    return { contracts: contractsCount, ghostProjects: ghostsCount };
  } finally {
    if (client) client.release();
  }
}

module.exports = { pool, initDB, resetAndReseed };
