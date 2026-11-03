import fs from 'node:fs';
import { pool } from '../src/db.js';
import { formatCode } from '../src/codes.js';

const base = process.env.PASS_BASE_URL || 'http://localhost:4000';

const { rows } = await pool.query(
  `SELECT household_name, contact_name, phone, max_party_size, token, backup_code
     FROM invitations ORDER BY household_name`
);

function message(r) {
  const name = r.contact_name || r.household_name;
  return [
    `Hello ${name},`,
    '',
    `Naomi & Lawrence's wedding flight NL 0711 boards this Saturday, 7 November 2026.`,
    '',
    'Here is your boarding pass for the reception at the Khomas Regional Council Hall:',
    `${base}/p/${r.token}`,
    '',
    `Please show it at the entrance. If the QR code does not scan, give the usher your booking reference: ${formatCode(r.backup_code)}`,
    '',
    'We look forward to celebrating with you!',
  ].join('\n');
}

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const lines = ['household,phone,admits,booking_reference,pass_link,whatsapp_link'];

for (const r of rows) {
  const pass = `${base}/p/${r.token}`;
  const wa = r.phone ? `https://wa.me/${r.phone}?text=${encodeURIComponent(message(r))}` : '';
  lines.push([r.household_name, r.phone, r.max_party_size, formatCode(r.backup_code), pass, wa].map(q).join(','));
}

fs.writeFileSync('data/pass-links.csv', lines.join('\n'));

const linea = rows.find((r) => r.household_name === 'Linea & Partner') || rows[0];
console.log(`Saved ${rows.length} links to data/pass-links.csv`);
console.log('Test pass:');
console.log(`${base}/p/${linea.token}`);
await pool.end();