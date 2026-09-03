const router = require('express').Router();
const { pool } = require('../db/index');

// GET /api/stats — powers the Overview dashboard and the Admin panel.
// This route did not exist in the previous version of the backend, which is
// why the dashboard stat cards and the admin panel always showed "--" /
// "Loading..." forever.
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
