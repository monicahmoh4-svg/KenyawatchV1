const router = require('express').Router();
const { pool } = require('../db/index');
const { COUNTIES } = require('../data/counties');

// GET /api/stats/by-county — Returns every county (even those with zero contracts)
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
    rows.forEach(row => { dataMap[row.county] = row; });
    
    // Guarantee all 47 counties are present in the response
    const completeData = COUNTIES.map(county => {
      return dataMap[county.name] || {
        county: county.name,
        contracts: 0,
        high_risk: 0,
        medium_risk: 0,
        funds_at_risk: 0
      };
    });
    
    // Sort by high_risk DESC, then contracts DESC
    completeData.sort((a, b) => {
      if (b.high_risk !== a.high_risk) return b.high_risk - a.high_risk;
      return b.contracts - a.contracts;
    });
    
    res.json({ success: true, data: completeData });
  } catch (e) {
    console.error('Stats by-county error:', e);
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
      pool.query("SELECT COUNT(*)::INT AS n FROM reports WHERE created_at > NOW() - INTERVAL '30 days'"),
      pool.query("SELECT COALESCE(SUM(value),0)::BIGINT AS n FROM contracts WHERE risk_level = 'HIGH'"),
      pool.query('SELECT COUNT(DISTINCT county)::INT AS n FROM contracts WHERE county IS NOT NULL'),
      pool.query("SELECT COUNT(*)::INT AS n FROM contracts WHERE data_type = 'documented'"),
    ]);

    res.json({
      success: true,
      data: {
        contracts_total: totals.rows[0].n,
        contracts_flagged: flagged.rows[0].n,
        ghost_projects: ghosts.rows[0].n,
        reports_30d: reports30d.rows[0].n,
        funds_at_risk: fundsAtRisk.rows[0].n,
        counties_covered: byCounty.rows[0].n,
        documented_cases: byDataType.rows[0].n,
      },
    });
  } catch (e) {
    console.error('Stats error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
