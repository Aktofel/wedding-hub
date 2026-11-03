import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

export async function login(req, res) {
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ error: 'Enter your PIN' });

  const { rows } = await query('SELECT id, name, role, pin_hash FROM staff WHERE active');
  for (const s of rows) {
    if (await bcrypt.compare(String(pin), s.pin_hash)) {
      const token = jwt.sign(
        { sub: s.id, name: s.name, role: s.role },
        process.env.JWT_SECRET,
        { expiresIn: '2d' }
      );
      return res.json({ token, name: s.name, role: s.role });
    }
  }
  res.status(401).json({ error: 'Wrong PIN' });
}

export const requireRole = (...roles) => (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!roles.includes(payload.role)) return res.status(403).json({ error: 'Not allowed' });
    req.staff = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in' });
  }
};

export async function pinInUse(pin) {
  const { rows } = await query('SELECT pin_hash FROM staff WHERE active');
  for (const s of rows) if (await bcrypt.compare(String(pin), s.pin_hash)) return true;
  return false;
}