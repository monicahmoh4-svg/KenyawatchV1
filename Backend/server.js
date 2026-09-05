require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDB } = require('./db/index');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// Security & CORS
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
}));
app.options('*', cors());

// Gentle rate limiting that doesn't block legitimate users
app.use('/api/ai', rateLimit({ windowMs: 60000, max: 120 }));
app.use('/api', rateLimit({ windowMs: 60000, max: 1000 }));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static frontend serving if accessed through backend port
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// API Routes
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/ghost-projects', require('./routes/ghostProjects'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/sync', require('./routes/ocdsSync'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/admin', require('./routes/admin'));

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', version: '4.0.0', service: 'KenyaWatch AI' }));

app.get('/api', (_req, res) => {
  res.status(200).json({
    name: 'KenyaWatch AI Procurement Intelligence API',
    version: '4.0.0',
    status: 'online',
    counties_covered: 47,
    endpoints: [
      'GET  /health',
      'GET  /api/stats',
      'GET  /api/stats/by-county',
      'GET  /api/stats/by-sector',
      'GET  /api/contracts',
      'GET  /api/contracts/meta',
      'GET  /api/contracts/export',
      'GET  /api/contracts/:contractId',
      'POST /api/contracts/scan',
      'GET  /api/ghost-projects',
      'POST /api/ghost-projects/:id/refresh-satellite',
      'GET  /api/reports',
      'POST /api/reports',
      'PATCH /api/reports/:id/status',
      'POST /api/ai/chat',
      'POST /api/sync/ocds',
      'GET  /api/sync/status',
      'GET  /api/admin/stats',
      'POST /api/admin/reseed',
    ],
  });
});

// Fallback to index.html for single-page app routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.path}` });
  }
  const indexPath = path.join(__dirname, '../frontend/public/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// Startup
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 KenyaWatch AI Backend running on port ${PORT}`);
  initDB().then(() => console.log('✅ Database initialized and ready for production')).catch(e => console.error('DB Error:', e));
});
