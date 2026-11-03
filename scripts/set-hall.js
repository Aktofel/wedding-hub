import { pool } from '../src/db.js';

await pool.query(
  `UPDATE events
      SET venue = 'Khomas Regional Council Hall',
          starts_at = '2026-11-07T16:00:00+02:00'
    WHERE code = 'hall'`
);
console.log('Hall reception set: doors open 16:00 on 7 November');
await pool.end();