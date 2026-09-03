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

const SCHEMA_SQL = `
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

  CREATE INDEX IF NOT EXISTS idx_contracts_county ON contracts(county);
  CREATE INDEX IF NOT EXISTS idx_contracts_year ON contracts(year);
  CREATE INDEX IF NOT EXISTS idx_contracts_sector ON contracts(sector);
  CREATE INDEX IF NOT EXISTS idx_contracts_risk ON contracts(risk_level);
`;

// Adds any columns that a pre-existing (older) deployment's table might be
// missing, so upgrading in place never crashes on a fresh Render deploy that
// reuses an old database.
async function ensureColumns(client) {
  const alterations = [
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS year INTEGER",
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS data_type VARCHAR(20) DEFAULT 'reference'",
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS source_name VARCHAR(300)",
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS source_url TEXT",
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE ghost_projects ADD COLUMN IF NOT EXISTS data_type VARCHAR(20) DEFAULT 'reference'",
    "ALTER TABLE ghost_projects ADD COLUMN IF NOT EXISTS source_name VARCHAR(300)",
    "ALTER TABLE ghost_projects ADD COLUMN IF NOT EXISTS source_url TEXT",
    "ALTER TABLE ghost_projects ADD COLUMN IF NOT EXISTS last_satellite_check TIMESTAMPTZ",
    "ALTER TABLE ocds_sync_log ADD COLUMN IF NOT EXISTS county VARCHAR(100)",
    "UPDATE contracts SET year = EXTRACT(YEAR FROM awarded_date)::INT WHERE year IS NULL AND awarded_date IS NOT NULL",
  ];
  for (const sql of alterations) {
    try { await client.query(sql); } catch (e) { /* column/constraint already fine */ }
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

  for (const r of rows) {
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
  }
  return rows.length;
}

async function seedGhostProjects(client) {
  for (const g of documentedGhostProjects) {
    await client.query(
      `INSERT INTO ghost_projects
        (contract_ref, project_name, county, sector, claimed_status, satellite_status, amount_at_risk,
         detection_status, confidence_score, latitude, longitude, data_type, source_name, source_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [g.contract_ref, g.project_name, g.county, g.sector, g.claimed_status, g.satellite_status,
        g.amount_at_risk, g.detection_status, g.confidence_score, g.latitude, g.longitude,
        g.data_type, g.source_name, g.source_url]
    );
  }
  return documentedGhostProjects.length;
}

const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    await client.query(SCHEMA_SQL);
    await ensureColumns(client);

    const { rowCount: hasContracts } = await client.query('SELECT 1 FROM contracts LIMIT 1');
    if (!hasContracts) {
      console.log('🌱 Seeding contracts (documented cases + 47-county reference set)...');
      const n = await seedContracts(client);
      console.log(`✅ Seeded ${n} contracts.`);
    }

    const { rowCount: hasGhosts } = await client.query('SELECT 1 FROM ghost_projects LIMIT 1');
    if (!hasGhosts) {
      console.log('🌱 Seeding ghost projects...');
      const n = await seedGhostProjects(client);
      console.log(`✅ Seeded ${n} ghost projects.`);
    }
  } catch (err) {
    console.error('❌ DB Init Error:', err.message);
  } finally {
    if (client) client.release();
  }
};

module.exports = { pool, initDB };
