const router = require('express').Router();
const https = require('https');
const { pool } = require('../db/index');

router.post('/chat', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ success: false, error: 'message required' });
  if (!process.env.GEMINI_API_KEY) {
    return res.json({ success: true, reply: '⚠️ AI investigator is not configured yet — set GEMINI_API_KEY in the backend environment variables to enable it.', fallback: true });
  }

  try {
    const cRes = await pool.query(
      "SELECT contract_id, county, value, risk_level FROM contracts ORDER BY risk_score DESC LIMIT 8"
    );
    const liveCtx = `\nLIVE DATABASE SNAPSHOT (top flagged contracts):\n` +
      cRes.rows.map(c => `- ${c.contract_id} | ${c.county} | KES ${c.value} | ${c.risk_level}`).join('\n');
    const systemText = `You are KenyaWatch AI, an expert anti-corruption investigator focused on Kenyan public procurement. Reference the Public Procurement and Asset Disposal Act (PPADA) 2015 and known EACC investigation patterns. Be specific, cite contract IDs from the live data when relevant, and use **bold** for key risks. Keep answers under 300 words.\n${liveCtx}`;

    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: message }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/gemini-2.5-flash:generateContent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const reqHttps = https.request(options, (resp) => {
      let raw = '';
      resp.on('data', (chunk) => { raw += chunk; });
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          const text = (parsed.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
          res.json({ success: true, reply: text || 'The AI service returned an empty response. Please try rephrasing your question.', fallback: !text });
        } catch (e) {
          res.json({ success: true, reply: 'The AI service response could not be parsed. Please try again shortly.', fallback: true });
        }
      });
    });
    reqHttps.on('error', () => res.json({ success: true, reply: 'Could not reach the AI service (network error). Please try again.', fallback: true }));
    reqHttps.write(body);
    reqHttps.end();
  } catch (e) {
    res.json({ success: true, reply: 'AI investigator error: ' + e.message, fallback: true });
  }
});

module.exports = router;
