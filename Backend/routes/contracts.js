const router = require('express').Router();
const { pool } = require('../db/index');
const { COUNTIES, SECTORS } = require('../data/counties');
const { scoreContract } = require('../utils/riskEngine');

// ── 1. GET /api/contracts/meta ──────────────────────────────────────────────
router.get('/meta', async (_req, res) => {
  let years = [];
  let countMap = {};
  try {
    const { rows } = await pool.query(`SELECT DISTINCT year FROM contracts WHERE year IS NOT NULL ORDER BY year DESC`);
    years = rows.map(r => r.year);
  } catch (e) { console.warn('⚠️ years query failed:', e.message); }

  try {
    const { rows } = await pool.query(`SELECT county, COUNT(*)::INT AS count FROM contracts WHERE county IS NOT NULL GROUP BY county`);
    countMap = Object.fromEntries(rows.map(r => [r.county, r.count]));
  } catch (e) { console.warn('⚠️ county counts query failed:', e.message); }

  if (years.length === 0) {
    const current = new Date().getFullYear();
    years = [current, current - 1, current - 2, current - 3, current - 4, current - 5];
  }

  res.json({
    success: true,
    data: {
      counties: COUNTIES.map(c => ({ ...c, contracts: countMap[c.name] || 0 })),
      sectors: SECTORS,
      years,
    },
  });
});

// ── 2. GET /api/contracts (List with filters) ───────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { county, sector, risk_level, year, data_type, search, limit = 100, page = 1 } = req.query;
    let query = 'SELECT * FROM contracts WHERE 1=1';
    const params = [];
    let pIdx = 1;

    if (county && county !== 'All') { query += ` AND county = $${pIdx}`; params.push(county); pIdx++; }
    if (sector && sector !== 'All') { query += ` AND sector = $${pIdx}`; params.push(sector); pIdx++; }
    if (risk_level && risk_level !== 'All') { query += ` AND risk_level = $${pIdx}`; params.push(risk_level); pIdx++; }
    if (year && year !== 'All') { query += ` AND year = $${pIdx}`; params.push(parseInt(year, 10)); pIdx++; }
    if (data_type && data_type !== 'All') { query += ` AND data_type = $${pIdx}`; params.push(data_type); pIdx++; }
    if (search) {
      query += ` AND (description ILIKE $${pIdx} OR supplier ILIKE $${pIdx} OR contract_id ILIKE $${pIdx} OR procuring_entity ILIKE $${pIdx})`;
      params.push(`%${search}%`); pIdx++;
    }

    const limitNum = Math.min(parseInt(limit, 10) || 100, 500);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)::INT AS total');
    const { rows: countRows } = await pool.query(countQuery, params);

    query += ` ORDER BY risk_score DESC, awarded_date DESC NULLS LAST LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
    params.push(limitNum, (pageNum - 1) * limitNum);

    const { rows } = await pool.query(query, params);
    
    // Safely parse JSONB flags to prevent frontend crashes
    const parsedRows = rows.map(row => {
      if (typeof row.flags === 'string') {
        try { row.flags = JSON.parse(row.flags); } catch (e) { row.flags = []; }
      } else if (!Array.isArray(row.flags)) {
        row.flags = [];
      }
      return row;
    });

    res.json({ success: true, data: parsedRows, count: parsedRows.length, total: countRows[0]?.total || 0, page: pageNum, limit: limitNum });
  } catch (e) {
    console.error('Contracts fetch error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── 3. GET /api/contracts/export (CSV Export) ───────────────────────────────
// CRITICAL: This MUST be defined BEFORE the /:contractId route.
router.get('/export', async (req, res) => {
  try {
    const { county, sector, risk_level, year, data_type, search } = req.query;
    let query = 'SELECT * FROM contracts WHERE 1=1';
    const params = [];
    let pIdx = 1;

    if (county && county !== 'All') { query += ` AND county = $${pIdx}`; params.push(county); pIdx++; }
    if (sector && sector !== 'All') { query += ` AND sector = $${pIdx}`; params.push(sector); pIdx++; }
    if (risk_level && risk_level !== 'All') { query += ` AND risk_level = $${pIdx}`; params.push(risk_level); pIdx++; }
    if (year && year !== 'All') { query += ` AND year = $${pIdx}`; params.push(parseInt(year, 10)); pIdx++; }
    if (data_type && data_type !== 'All') { query += ` AND data_type = $${pIdx}`; params.push(data_type); pIdx++; }
    if (search) {
      query += ` AND (description ILIKE $${pIdx} OR supplier ILIKE $${pIdx} OR contract_id ILIKE $${pIdx} OR procuring_entity ILIKE $${pIdx})`;
      params.push(`%${search}%`); pIdx++;
    }
    query += ' ORDER BY risk_score DESC, awarded_date DESC NULLS LAST';

    const { rows } = await pool.query(query, params);

    const cols = ['contract_id', 'description', 'county', 'sector', 'value', 'supplier', 'bid_type', 'awarded_date', 'year', 'risk_score', 'risk_level', 'procuring_entity', 'data_type', 'source_name', 'source_url'];
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    
    const header = cols.join(',');
    const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n');
    const csv = '\uFEFF' + header + '\n' + body; // Add BOM for Excel compatibility

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kenyawatch-contracts.csv"');
    res.send(csv);
  } catch (e) {
    console.error('CSV Export error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── 4. GET /api/contracts/:contractId (Detail View) ─────────────────────────
router.get('/:contractId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM contracts WHERE contract_id = $1 OR id::TEXT = $1`,
      [req.params.contractId]
    );
    
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }
    
    const contract = rows[0];
    
    // Safely parse flags whether PG returns it as string or object
    if (typeof contract.flags === 'string') {
      try { contract.flags = JSON.parse(contract.flags); } catch (e) { contract.flags = []; }
    } else if (!Array.isArray(contract.flags)) {
      contract.flags = [];
    }
    
    res.json({ success: true, data: contract });
  } catch (e) {
    console.error('Contract detail error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── 5. POST /api/contracts/scan ─────────────────────────────────────────────
router.post('/scan', async (req, res) => {
  try {
    const { contract_id, supplier, description, county, sector, value, bid_type, awarded_date, procuring_entity, supplier_reg_date } = req.body;
    if (!contract_id || !supplier || !value) {
      return res.status(400).json({ success: false, error: 'contract_id, supplier and value are required' });
    }

    const { risk_score, risk_level, flags } = scoreContract({ bid_type, value, description, supplier_reg_date, awarded_date });
    const year = awarded_date ? new Date(awarded_date).getFullYear() : null;

    const { rows } = await pool.query(
      `INSERT INTO contracts 
        (contract_id, description, county, sector, value, supplier, supplier_reg_date, bid_type, awarded_date, year, risk_score, risk_level, flags, procuring_entity, data_type, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'manual_scan','manual')
       ON CONFLICT (contract_id) DO UPDATE SET
         description=EXCLUDED.description, county=EXCLUDED.county, sector=EXCLUDED.sector, value=EXCLUDED.value,
         supplier=EXCLUDED.supplier, bid_type=EXCLUDED.bid_type, awarded_date=EXCLUDED.awarded_date, year=EXCLUDED.year,
         risk_score=EXCLUDED.risk_score, risk_level=EXCLUDED.risk_level, flags=EXCLUDED.flags, updated_at=NOW()
       RETURNING *`,
      [contract_id, description || '', county || null, sector || null, value, supplier, supplier_reg_date || null,
        bid_type || 'open', awarded_date || null, year, risk_score, risk_level, JSON.stringify(flags), procuring_entity || null]
    );
    
    const contract = rows[0];
    if (typeof contract.flags === 'string') {
      try { contract.flags = JSON.parse(contract.flags); } catch (e) { contract.flags = []; }
    }
    
    res.json({ success: true, data: contract });
  } catch (e) {
    console.error('Contract scan error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
