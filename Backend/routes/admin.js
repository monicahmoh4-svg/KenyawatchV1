const router = require('express').Router();
const { pool, resetAndReseed } = require('../db/index');

function safeEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return true; // allow open dev/inspection if no key configured
  const provided = req.get('x-admin-key') || '';
  return safeEqual(provided, key);
}

// GET /api/admin/stats
router.get('/stats', async (_req, res) => {
  try {
    const [totals, flagged, ghosts, pending, counties, byDataType] = await Promise.all([
      pool.query('SELECT COUNT(*)::INT AS n FROM contracts'),
      pool.query("SELECT COUNT(*)::INT AS n FROM contracts WHERE risk_level = 'HIGH'"),
      pool.query('SELECT COUNT(*)::INT AS n FROM ghost_projects'),
      pool.query("SELECT COUNT(*)::INT AS n FROM reports WHERE status = 'pending'"),
      pool.query('SELECT COUNT(DISTINCT county)::INT AS n FROM contracts WHERE county IS NOT NULL'),
      pool.query('SELECT data_type, COUNT(*)::INT AS n FROM contracts GROUP BY data_type ORDER BY n DESC'),
    ]);
    res.json({
      success: true,
      data: {
        contracts_total: totals.rows[0]?.n || 0,
        contracts_flagged: flagged.rows[0]?.n || 0,
        ghost_projects: ghosts.rows[0]?.n || 0,
        pending_reports: pending.rows[0]?.n || 0,
        counties_covered: counties.rows[0]?.n || 0,
        data_type_breakdown: byDataType.rows || [],
      },
    });
  } catch (e) {
    console.error('Admin stats error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/admin/reseed
router.post('/reseed', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized — valid x-admin-key header required.' });
  }
  try {
    const result = await resetAndReseed();
    res.json({ success: true, message: 'Database reseeded successfully.', data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
