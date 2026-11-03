import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { login } from './auth.js';
import guestRoutes from './routes/guest.js';
import adminRoutes from './routes/admin.js';
import checkinRoutes from './routes/checkin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const scannerFile = path.join(__dirname, '../node_modules/html5-qrcode/html5-qrcode.min.js');

const app = express();
app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(cors({ origin: process.env.PUBLIC_BASE_URL }));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/staff/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }), login);
app.use('/api/i', rateLimit({ windowMs: 60 * 1000, limit: 300 }), guestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/checkin', checkinRoutes);

// Guest boarding pass page
app.get('/p/:token', (req, res) => res.sendFile(path.join(publicDir, 'pass.html')));

// Usher check in page and its QR scanner
app.get('/usher', (req, res) => res.sendFile(path.join(publicDir, 'usher.html')));
app.get('/vendor/html5-qrcode.min.js', (req, res) => res.sendFile(scannerFile));

app.use(express.static(publicDir));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Wedding Hub API on port ${port}`));
