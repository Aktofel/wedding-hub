import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { pool, tx } from '../src/db.js';
import { newToken, newBackupCode, normalizePhone } from '../src/codes.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import -- path/to/guests.csv');
  process.exit(1);
}

const records = parse(fs.readFileSync(file), {
  columns: (header) => header.map((c) => c.trim().toLowerCase()),
  skip_empty_lines: true,
  trim: true,
});

const { rows: events } = await pool.query('SELECT id, code FROM events');
const eventId = Object.fromEntries(events.map((e) => [e.code, e.id]));
const yes = (v) => ['yes', 'y', 'true', '1'].includes(String(v || '').toLowerCase());

async function uniqueBackupCode(client) {
  for (;;) {
    const code = newBackupCode();
    const { rowCount } = await client.query('SELECT 1 FROM invitations WHERE backup_code = $1', [code]);
    if (!rowCount) return code;
  }
}

let created = 0;
let updated = 0;
const errors = [];

for (const [i, r] of records.entries()) {
  const line = i + 2;
  const household = r.household_name;
  if (!household) { errors.push(`Line ${line}: household_name is empty`); continue; }

  const phone = normalizePhone(r.phone);
  const size = parseInt(r.party_size || '1', 10);
  if (!(size > 0)) { errors.push(`Line ${line}: party_size must be 1 or more`); continue; }

  const reception = (r.reception || 'hall').toLowerCase();
  const codes = reception === 'both' ? ['home', 'hall'] : [reception];
  if (codes.some((c) => !eventId[c])) {
    errors.push(`Line ${line}: reception must be home, hall or both`);
    continue;
  }

  const importKey = `${household.toLowerCase().replace(/\s+/g, ' ')}|${phone || ''}`;
  const fields = [household, r.contact_name || null, phone, size, r.side || null, yes(r.vip), r.language || 'en', r.notes || null];

  try {
    const isNew = await tx(async (c) => {
      const existing = await c.query('SELECT id FROM invitations WHERE import_key = $1', [importKey]);
      let invId;
      if (existing.rowCount) {
        invId = existing.rows[0].id;
        await c.query(
          `UPDATE invitations SET household_name = $2, contact_name = $3, phone = $4,
                  max_party_size = $5, side = $6, vip = $7, language = $8, notes = $9
            WHERE id = $1`,
          [invId, ...fields]
        );
      } else {
        const ins = await c.query(
          `INSERT INTO invitations (household_name, contact_name, phone, max_party_size, side, vip,
                                    language, notes, import_key, token, backup_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [...fields, importKey, newToken(), await uniqueBackupCode(c)]
        );
        invId = ins.rows[0].id;
      }

      const ids = codes.map((k) => eventId[k]);
      await c.query(
        'DELETE FROM invitation_events WHERE invitation_id = $1 AND NOT (event_id = ANY($2::int[]))',
        [invId, ids]
      );

      for (const code of codes) {
        const label = r[`table_${code}`] || null;
        let tableId = null;
        if (label) {
          const t = await c.query(
            `INSERT INTO seating_tables (event_id, label) VALUES ($1, $2)
             ON CONFLICT (event_id, label) DO UPDATE SET label = EXCLUDED.label
             RETURNING id`,
            [eventId[code], label]
          );
          tableId = t.rows[0].id;
        }
        await c.query(
          `INSERT INTO invitation_events (invitation_id, event_id, table_id) VALUES ($1, $2, $3)
           ON CONFLICT (invitation_id, event_id) DO UPDATE SET table_id = EXCLUDED.table_id`,
          [invId, eventId[code], tableId]
        );
      }
      return !existing.rowCount;
    });
    isNew ? created++ : updated++;
  } catch (err) {
    errors.push(`Line ${line}: ${err.message}`);
  }
}

console.log(`Created ${created}, updated ${updated}, errors ${errors.length}`);
errors.forEach((e) => console.log('  ' + e));
await pool.end();