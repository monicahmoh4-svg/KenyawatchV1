const router = require('express').Router();
const https = require('https');
const zlib = require('zlib');
const { pool } = require('../db/index');
const { matchCountyInText } = require('../data/counties');
const { scoreContract } = require('../utils/riskEngine');

// Kenya's national feed on the Open Contracting Partnership's public data
// registry. Kenya's own procurement portal (PPIP) is not yet fully OCDS
// compliant (see ICJ Kenya / OGP reporting), so this registry mirror is the
// most reliable machine-readable source currently available for automated
// ingestion. If OCP retires or moves this publication, this fetch will fail
// gracefully and the sync log will show the error — it will never crash the app.
const OCDS_BASE = 'https://data.open-contracting.org/en/publication/147/download';

function fetchAndIngest(year, county, logId) {
  return new Promise((resolve, reject) => {
    const url = `${OCDS_BASE}?name=${year}.jsonl.gz`;
    console.log(`📥 Fetching OCDS data from: ${url}`);

    const req = https.get(url, { timeout: 300000 }, (resp) => {
      if (resp.statusCode === 301 || resp.statusCode === 302) {
        resp.resume();
        return https.get(resp.headers.location, { timeout: 300000 }, (resp2) => processStream(resp2, county, logId, resolve, reject));
      }
      if (resp.statusCode !== 200) {
        resp.resume();
        return reject(new Error(`HTTP ${resp.statusCode} from Open Contracting Partnership registry`));
      }
      processStream(resp, county, logId, resolve, reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Download timeout — the upstream registry did not respond in time')); });
  });
}

function processStream(resp, countyFilter, logId, resolve, reject) {
  const gunzip = zlib.createGunzip();
  resp.pipe(gunzip);
  gunzip.setEncoding('utf8');

  let buffer = '', inserted = 0, parsed = 0, matched = 0, batch = [], flushing = false;

  async function flush() {
    if (flushing || !batch.length) return;
    flushing = true;
    const rows = batch.splice(0);
    try {
      const client = await pool.connect();
      for (const r of rows) {
        try {
          await client.query(
            `INSERT INTO contracts
              (contract_id, description, county, sector, value, supplier, bid_type, awarded_date, year, risk_score, risk_level, flags, procuring_entity, data_type, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'live_sync','ocds')
             ON CONFLICT (contract_id) DO UPDATE SET
               description=EXCLUDED.description, risk_score=EXCLUDED.risk_score, risk_level=EXCLUDED.risk_level,
               flags=EXCLUDED.flags, updated_at=NOW()`,
            [r.contract_id, r.description, r.county, r.sector, r.value, r.supplier, r.bid_type, r.awarded_date,
              r.year, r.risk_score, r.risk_level, JSON.stringify(r.flags), r.procuring_entity]
          );
          inserted++;
        } catch (err) { /* skip individual malformed rows without aborting the sync */ }
      }
      client.release();
      await pool.query('UPDATE ocds_sync_log SET records=$1 WHERE id=$2', [inserted, logId]);
    } catch (err) {
      console.error('Batch insert error:', err.message);
    }
    flushing = false;
  }

  gunzip.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line);
        if (rec.ocid && rec.tender?.title) {
          const buyerName = rec.buyer?.name || '';
          const county = matchCountyInText(buyerName) || matchCountyInText(rec.tender.title) || 'National';
          if (countyFilter && countyFilter !== 'All' && county !== countyFilter) continue;
          matched++;

          const value = Math.round(rec.tender.value?.amount || 0);
          const bid_type = rec.tender.procurementMethod || 'open';
          const awarded_date = rec.awards?.[0]?.date?.slice(0, 10) || null;
          const description = (rec.tender.title || '').slice(0, 499);
          const { risk_score, risk_level, flags } = scoreContract({ bid_type, value, description, awarded_date });

          batch.push({
            contract_id: `OCDS-${rec.ocid}`.slice(0, 119),
            description, county, sector: 'Infrastructure', value,
            supplier: rec.awards?.[0]?.suppliers?.[0]?.name || 'Unknown',
            bid_type, awarded_date, year: awarded_date ? new Date(awarded_date).getFullYear() : null,
            risk_score, risk_level, flags, procuring_entity: buyerName,
          });
          parsed++;
        }
      } catch (e) { /* skip malformed JSON line */ }
      if (batch.length >= 50) {
        gunzip.pause();
        flush().then(() => gunzip.resume()).catch(() => gunzip.resume());
      }
    }
  });

  gunzip.on('end', async () => {
    await flush();
    console.log(`🎉 Sync complete: parsed ${parsed}, matched filter ${matched}, inserted ${inserted}`);
    resolve({ inserted, parsed, matched });
  });
  gunzip.on('error', reject);
}

// POST /api/sync/ocds  { year, county? }
router.post('/ocds', async (req, res) => {
  try {
    const { year, county } = req.body || {};
    if (!year) return res.status(400).json({ success: false, error: 'year is required' });

    const { rows } = await pool.query(
      `INSERT INTO ocds_sync_log (year, county, status) VALUES ($1, $2, 'running') RETURNING id`,
      [year, county && county !== 'All' ? county : null]
    );
    const logId = rows[0].id;

    res.json({ success: true, message: 'Sync started in the background — check status shortly.', logId });

    setImmediate(async () => {
      try {
        const result = await fetchAndIngest(year, county, logId);
        await pool.query(
          "UPDATE ocds_sync_log SET status='complete', records=$1, finished_at=NOW() WHERE id=$2",
          [result.inserted, logId]
        );
      } catch (e) {
        console.error('Sync failed:', e.message);
        await pool.query(
          "UPDATE ocds_sync_log SET status='failed', error_msg=$1, finished_at=NOW() WHERE id=$2",
          [e.message, logId]
        );
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/status', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM ocds_sync_log ORDER BY started_at DESC LIMIT 10');
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
