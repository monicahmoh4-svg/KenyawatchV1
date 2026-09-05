const router = require('express').Router();
const { pool, resetAndReseed } = require('../db/index');

// Simple constant-time-ish comparison to avoid leaking the key length.
function safeEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return false; // reseed disabled unless ADMIN_API_KEY is set
  const provided = req.get('x-admin-key') || '';
  return safeEqual(provided, key);
}

// GET /api/admin/stats — richer stats for the admin panel (contracts, high
// risk, counties, pending reports, plus a few extra operational numbers).
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
        contracts_total: totals.rows[0].n,
        contracts_flagged: highRisk.rows[0].n,
        ghost_projects: ghosts.rows[0].n,
        pending_reports: counties.rows[0].n,
        counties_covered: counties.rows[0].n,
        data_type_breakdown: dataType.rows,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/admin/reseed — wipes contracts + ghost_projects and re-seeds from
// the canonical documented + reference datasets. Protected by x-admin-key.
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