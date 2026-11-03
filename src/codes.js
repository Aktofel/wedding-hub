import crypto from 'node:crypto';

// No 0/O, 1/I/L so codes are easy to read and type at the door
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newToken() {
  return crypto.randomBytes(16).toString('base64url');
}

export function newBackupCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return code;
}

// K7P2QX -> K7P-2QX
export function formatCode(code) {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

// What an usher types: "k7p 2qx" -> K7P2QX
export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// What goes inside the QR code
export function qrPayload(token) {
  return `WH:${token}`;
}

// Namibian numbers to international format without + (what wa.me needs)
export function normalizePhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '264' + d.slice(1);
  else if (d.length === 9 && d.startsWith('8')) d = '264' + d;
  return d || null;
}