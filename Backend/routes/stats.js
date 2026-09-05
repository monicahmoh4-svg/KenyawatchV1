const router = require('express').Router();
const { pool } = require('../db/index');
const { COUNTIES, SECTORS } = require('../data/counties');

// GET /api/stats/by-county — Returns all 47 counties
router.get('/by-county', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT county,
             COUNT(*)::INT AS contracts,
             COUNT(*) FILTER (WHERE risk_level = 'HIGH')::INT AS high_risk,
             COUNT(*) FILTER (WHERE risk_level = 'MEDIUM')::INT AS medium_risk,
             COALESCE(SUM(value) FILTER (WHERE risk_level = 'HIGH'), 0)::BIGINT AS funds_at_risk
      FROM contracts
      WHERE county IS NOT NULL
      GROUP BY county
    `);
    
    const dataMap = {};
    (rows || []).forEach(row => { dataMap[row.county] = row; });
    
    // Guarantee all 47 counties are present
    const completeData = COUNTIES.map(county => {
      const match = dataMap[county.name];
      return {
        county: county.name,
        code: county.code,
        region: county.region,
        contracts: match ? match.contracts : 0,
        high_risk: match ? match.high_risk : 0,
        medium_risk: match ? match.medium_risk : 0,
        funds_at_risk: match ? match.funds_at_risk : 0,
      };
    });
    
    // Sort by high_risk DESC, then funds_at_risk DESC
    completeData.sort((a, b) => {
      if (b.high_risk !== a.high_risk) return b.high_risk - a.high_risk;
      return b.funds_at_risk - a.funds_at_risk;
    });
    
    res.json({ success: true, data: completeData });
  } catch (e) {
    console.error('Stats by-county error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/stats/by-sector
router.get('/by-sector', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sector,
             COUNT(*)::INT AS contracts,
             COUNT(*) FILTER (WHERE risk_level = 'HIGH')::INT AS high_risk,
             COALESCE(SUM(value), 0)::BIGINT AS total_value
      FROM contracts
      WHERE sector IS NOT NULL
      GROUP BY sector
    `);
    res.json({ success: true, data: rows || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/stats — Powers the Overview dashboard
router.get('/', async (_req, res) => {
  try {
    const [totals, flagged, ghosts, reports30d, fundsAtRisk, byCounty, byDataType] = await Promise.all([
      pool.query('SELECT COUNT(*)::INT AS n FROM contracts'),
      pool.query("SELECT COUNT(*)::INT AS n FROM contracts WHERE risk_level = 'HIGH'"),
      pool.query('SELECT COUNT(*)::INT AS n FROM ghost_projects'),
      pool.query("SELECT COUNT(*)::INT AS n FROM reports"),
      pool.query("SELECT COALESCE(SUM(value),0)::BIGINT AS n FROM contracts WHERE risk_level = 'HIGH'"),
      pool.query('SELECT COUNT(DISTINCT county)::INT AS n FROM contracts WHERE county IS NOT NULL'),
      pool.query("SELECT COUNT(*)::INT AS n FROM contracts WHERE data_type = 'documented'"),
    ]);

    res.json({
      success: true,
      data: {
        contracts_total: totals.rows[0]?.n || 0,
        contracts_flagged: flagged.rows[0]?.n || 0,
        ghost_projects: ghosts.rows[0]?.n || 0,
        reports_30d: reports30d.rows[0]?.n || 0,
        funds_at_risk: fundsAtRisk.rows[0]?.n || 0,
        counties_covered: byCounty.rows[0]?.n || 47,
        documented_cases: byDataType.rows[0]?.n || 0,
      },
    });
  } catch (e) {
    console.error('Stats error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
