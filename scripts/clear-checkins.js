import { pool } from '../src/db.js';

const r = await pool.query('DELETE FROM checkins');
console.log(`Cleared ${r.rowCount} test check ins`);
await pool.end();