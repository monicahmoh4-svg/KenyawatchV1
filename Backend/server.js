require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDB } = require('./db/index');

const app = express();
const PORT = process.env.PORT || 5000;

// Render/Vercel sit behind a reverse proxy — without this, express-rate-limit
// reads the proxy's IP instead of the client's and throws/limits incorrectly.
app.set('trust proxy', 1);

// ── Security & CORS ───────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());

app.use('/api/ai', rateLimit({ windowMs: 60000, max: 40 }));
app.use('/api/chatbot', rateLimit({ windowMs: 60000, max: 40 }));
app.use('/api', rateLimit({ windowMs: 60000, max: 500 }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static admin panel (previously created but never served) ─────────────────
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/ghost-projects', require('./routes/ghostProjects'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/sync', require('./routes/ocdsSync'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/admin', require('./routes/admin'));

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', version: '3.5.0' }));

app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'KenyaWatch AI Backend',
    version: '3.5.0',
    endpoints: [
      'GET  /health',
      'GET  /api/stats',
      'GET  /api/contracts',
      'GET  /api/contracts/meta',
      'GET  /api/contracts/:contractId',
      'POST /api/contracts/scan',
      'GET  /api/ghost-projects',
      'POST /api/ghost-projects/:id/refresh-satellite',
      'GET  /api/reports',
      'POST /api/reports',
      'PATCH /api/reports/:id/status',
      'POST /api/ai/chat',
      'POST /api/chatbot/message',
      'POST /api/sync/ocds',
      'GET  /api/sync/status',
      'GET  /api/admin/stats',
      'POST /api/admin/reseed (protected — requires x-admin-key header)',
      'GET  /admin',
    ],
  });
});

app.use((req, res) => res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.path}` }));

// ── Startup: LISTEN FIRST ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 KenyaWatch AI Backend running on port ${PORT}`);
  initDB().then(() => console.log('✅ Database initialized and seeded')).catch(e => console.error('DB Error:', e));
});
