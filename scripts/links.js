import fs from 'node:fs';
import { pool } from '../src/db.js';
import { formatCode } from '../src/codes.js';

const base = process.env.PASS_BASE_URL || 'http://localhost:4000';

const { rows } = await pool.query(
  `SELECT household_name, contact_name, phone, max_party_size, token, backup_code, notes
     FROM invitations ORDER BY household_name`
);

function message(r) {
  const name = r.contact_name || r.household_name;
  return [
    `Hello ${name},`,
    '',
    `Naomi & Lawrence's wedding flight NL 0711 boards this Saturday, 7 November 2026.`,
    '',
    'Here is your boarding pass for the reception at the Khomas Regional Council Hall. Doors open at 16:00:',
    `${base}/p/${r.token}`,
    '',
    `Please open it now and take a screenshot, then show it at the entrance in case you do not have internet connection at the hall. If the QR code does not scan, give the usher your booking reference: ${formatCode(r.backup_code)}`,
    '',
    'We look forward to celebrating with you!',
  ].join('\n');
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// 1. Spreadsheet with every link
const lines = ['household,phone,admits,booking_reference,pass_link,whatsapp_link'];
for (const r of rows) {
  const pass = `${base}/p/${r.token}`;
  const wa = r.phone ? `https://wa.me/${r.phone}?text=${encodeURIComponent(message(r))}` : '';
  lines.push([r.household_name, r.phone, r.max_party_size, formatCode(r.backup_code), pass, wa].map(q).join(','));
}
fs.writeFileSync('data/pass-links.csv', lines.join('\n'));

// 2. Send page: one button per guest, ticks remembered in this browser
const withPhone = rows.filter((r) => r.phone);
const noPhone = rows.filter((r) => !r.phone);

const item = (r) => `
  <li data-id="${esc(r.token)}">
    <label><input type="checkbox"> <b>${esc(r.household_name)}</b>
      <small>admits ${r.max_party_size} · ${esc(formatCode(r.backup_code))}${r.notes ? ' · ' + esc(r.notes) : ''}</small></label>
    ${r.phone
      ? `<a class="wa" target="_blank" href="https://wa.me/${r.phone}?text=${encodeURIComponent(message(r))}">Send on WhatsApp</a>`
      : `<a class="pass" target="_blank" href="${base}/p/${r.token}">Open pass</a>`}
  </li>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Send boarding passes</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f8e8cf; color: #311f15; margin: 0; padding: 20px; }
  h1 { font-size: 20px; margin: 0 0 4px; } p { margin: 0 0 16px; color: #68462d; }
  h2 { font-size: 15px; margin: 24px 0 8px; }
  ul { list-style: none; padding: 0; margin: 0; max-width: 760px; }
  li { background: #fffaf1; border-radius: 10px; padding: 10px 14px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  li.done { opacity: 0.45; }
  small { display: block; color: #7a5c46; margin-left: 24px; }
  a { text-decoration: none; padding: 8px 12px; border-radius: 8px; font-weight: 600; white-space: nowrap; }
  .wa { background: #1f8f4e; color: #fff; } .pass { background: #311f15; color: #f8e8cf; }
  #count { font-weight: 700; }
</style></head><body>
<h1>Boarding passes · Naomi &amp; Lawrence</h1>
<p><span id="count"></span> sent. Click Send, press send in WhatsApp, then come back. The tick is added for you.</p>
<h2>WhatsApp (${withPhone.length})</h2>
<ul>${withPhone.map(item).join('')}</ul>
<h2>No phone number: print or forward (${noPhone.length})</h2>
<ul>${noPhone.map(item).join('')}</ul>
<script>
  const KEY = 'wh_sent';
  let sent = {};
  try { sent = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(sent)); } catch {} };
  const items = document.querySelectorAll('li');
  function paint() {
    let n = 0;
    items.forEach((li) => {
      const on = !!sent[li.dataset.id];
      li.querySelector('input').checked = on;
      li.classList.toggle('done', on);
      if (on) n++;
    });
    document.getElementById('count').textContent = n + ' of ' + items.length;
  }
  items.forEach((li) => {
    li.querySelector('input').onchange = (e) => { sent[li.dataset.id] = e.target.checked; save(); paint(); };
    li.querySelector('a').addEventListener('click', () => { sent[li.dataset.id] = true; save(); paint(); });
  });
  paint();
</script>
</body></html>`;
fs.writeFileSync('data/send.html', html);

console.log(`Saved ${rows.length} links to data/pass-links.csv`);
console.log(`Send page: data/send.html (${withPhone.length} on WhatsApp, ${noPhone.length} without a number)`);
await pool.end();
