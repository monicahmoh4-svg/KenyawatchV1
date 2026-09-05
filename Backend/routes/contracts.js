const router = require('express').Router();
const { pool } = require('../db/index');
const { COUNTIES, SECTORS } = require('../data/counties');
const { scoreContract } = require('../utils/riskEngine');

// GET /api/contracts/meta — drives every filter dropdown in the frontend so
// the UI is always in sync with the real 47-county / sector list, and never
// hard-codes a partial list again.
//
// Each sub-query is isolated with its own try/catch: if the "year" column (or
// any other) is temporarily missing on a not-yet-migrated database, that
// single query degrades gracefully to an empty list instead of 500-ing the
// whole endpoint and blanking out every dropdown in the UI at once.
router.get('/meta', async (_req, res) => {
  let years = [];
  let countMap = {};

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT year FROM contracts WHERE year IS NOT NULL ORDER BY year DESC`
    );
    years = rows.map(r => r.year);
  } catch (e) {
    console.warn('⚠️ /api/contracts/meta: years query failed:', e.message);
  }

  try {
    const { rows } = await pool.query(
      `SELECT county, COUNT(*)::INT AS count FROM contracts WHERE county IS NOT NULL GROUP BY county`
    );
    countMap = Object.fromEntries(rows.map(r => [r.county, r.count]));
  } catch (e) {
    console.warn('⚠️ /api/contracts/meta: county counts query failed:', e.message);
  }

  // Always fall back to the last 6 calendar years so the Year dropdown is
  // never empty even before any data has been synced/migrated in.
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

// GET /api/contracts — list with filters. Supports filtering & syncing views
// by county and/or year, plus sector, risk level, data type, and free search.
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
    res.json({ success: true, data: rows, count: rows.length, total: countRows[0]?.total || 0, page: pageNum, limit: limitNum });
  } catch (e) {
    console.error('Contracts fetch error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/contracts/export — CSV export of the current filtered view, so
// researchers/journalists can download the dataset. Reuses the same filter
// logic as the list endpoint. Must be declared BEFORE /:contractId.
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
    const csv = header + '\n' + body;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kenyawatch-contracts.csv"');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/contracts/:contractId — full detail for the contract modal.
router.get('/:contractId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM contracts WHERE contract_id = $1 OR id::TEXT = $1`,
      [req.params.contractId]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Contract not found' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/contracts/scan — manually score a new/candidate contract using
// the shared risk engine (same rules as seeding & OCDS ingestion) and store it.
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
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
