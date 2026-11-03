import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, query } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, '../src/schema.sql'), 'utf8');

await query(sql);

// Both receptions. Home is not gated until the family decides otherwise.
await query(
  `INSERT INTO events (code, name, venue, gated) VALUES
     ('home', 'Home reception', NULL, false),
     ('hall', 'Main reception', 'Khomas Regional Council hall', true)
   ON CONFLICT (code) DO NOTHING`
);

const { rows } = await query(`SELECT count(*)::int AS n FROM staff WHERE role = 'admin'`);
if (rows[0].n === 0) {
  const pin = process.env.ADMIN_PIN;
  if (!/^\d{6}$/.test(String(pin))) throw new Error('Set ADMIN_PIN to 6 digits in .env');
  await query(`INSERT INTO staff (name, role, pin_hash) VALUES ($1, 'admin', $2)`, [
    process.env.ADMIN_NAME || 'Admin',
    await bcrypt.hash(String(pin), 10),
  ]);
  console.log('Admin account created');
}

console.log('Migration done');
await pool.end();