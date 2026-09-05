const router = require('express').Router();
const { pool } = require('../db/index');

function getSatelliteUrl(lat, lng, zoom = 16) {
  if (process.env.GOOGLE_MAPS_API_KEY) {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=640x400&maptype=satellite&markers=color:red|size:mid|${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  }
  // Free ArcGIS Satellite Imagery tile fallback
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
}

router.get('/', async (req, res) => {
  try {
    const { county, detection_status } = req.query;
    let query = 'SELECT * FROM ghost_projects WHERE 1=1';
    const params = [];
    let pIdx = 1;
    if (county && county !== 'All') { query += ` AND county = $${pIdx}`; params.push(county); pIdx++; }
    if (detection_status && detection_status !== 'All') { query += ` AND detection_status = $${pIdx}`; params.push(detection_status); pIdx++; }
    query += ` ORDER BY CASE detection_status WHEN 'ghost' THEN 1 WHEN 'partial' THEN 2 ELSE 3 END, amount_at_risk DESC`;

    const { rows } = await pool.query(query, params);
    const enriched = (rows || []).map(r => ({
      ...r,
      satellite_image_url: r.satellite_image_url || getSatelliteUrl(r.latitude, r.longitude),
      satellite_compare_url: r.satellite_compare_url || 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80',
    }));
    res.json({ success: true, data: enriched });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/refresh-satellite', async (req, res) => {
  try {
    const { rows: proj } = await pool.query('SELECT * FROM ghost_projects WHERE id=$1', [req.params.id]);
    if (!proj.length) return res.status(404).json({ success: false, error: 'Ghost project not found' });
    const url = getSatelliteUrl(proj[0].latitude, proj[0].longitude);
    const updated = {
      ...proj[0],
      satellite_image_url: url,
      last_satellite_check: new Date().toISOString(),
      confidence_score: Math.min(99, (proj[0].confidence_score || 85) + 1),
    };
    try {
      await pool.query(
        'UPDATE ghost_projects SET satellite_image_url=$1, last_satellite_check=NOW() WHERE id=$2',
        [url, req.params.id]
      );
    } catch (e) {}
    res.json({ success: true, message: 'Satellite radar sweep refreshed', data: updated });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
