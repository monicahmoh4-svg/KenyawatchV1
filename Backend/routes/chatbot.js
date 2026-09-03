const router = require('express').Router();

router.post('/message', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ success: false, error: 'message required' });
  const lower = message.toLowerCase();
  let reply = "Habari! I'm KenyaWatch AI. How can I assist you today?";
  if (lower.includes('report') || lower.includes('bribe')) reply = "To report corruption, please use the 'Report' tab. Your identity is fully protected and reporting is anonymous by default.";
  else if (lower.includes('ghost')) reply = "Ghost projects are verified by comparing satellite imagery against government-reported completion status. Check the 'Ghost Projects' tab.";
  else if (lower.includes('eacc')) reply = 'Contact the EACC at 0800 720 880 (free, 24/7) or via eacc.go.ke.';
  else if (lower.includes('county') || lower.includes('sync')) reply = "You can browse contracts by any of Kenya's 47 counties and by year in the 'Procurement' tab, and pull live official data in 'Sync Data'.";
  res.json({ success: true, reply, fallback: true });
});

module.exports = router;
