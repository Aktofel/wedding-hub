import { Router } from 'express';
import { query } from '../db.js';
import { requireRole } from '../auth.js';
import { formatCode } from '../codes.js';

const router = Router();
router.use(requireRole('usher', 'coordinator', 'admin'));

async function hallId() {
  const { rows } = await query(`SELECT id FROM events WHERE code = 'hall'`);
  return rows[0].id;
}

async function roster(eventId) {
  const { rows } = await query(
    `SELECT i.id, i.household_name, i.max_party_size, i.token, i.backup_code, i.notes,
            COALESCE(sum(c.people_count), 0)::int AS arrived,
            max(c.checked_in_at) AS last_in
       FROM invitations i
       JOIN invitation_events ie ON ie.invitation_id = i.id AND ie.event_id = $1
       LEFT JOIN checkins c ON c.invitation_id = i.id AND c.event_id = $1
      GROUP BY i.id
      ORDER BY i.household_name`,
    [eventId]
  );
  const walkins = await query(
    `SELECT COALESCE(sum(people_count), 0)::int AS n FROM checkins
      WHERE event_id = $1 AND invitation_id IS NULL`,
    [eventId]
  );
  return {
    guests: rows.map((r) => ({
      id: r.id,
      name: r.household_name,
      party: r.max_party_size,
      token: r.token,
      code: r.backup_code,
      display_code: formatCode(r.backup_code),
      notes: r.notes,
      arrived: r.arrived,
      last_in: r.last_in,
    })),
    walkins: walkins.rows[0].n,
  };
}

// Full passenger list for the usher phone (kept on the phone for offline use)
router.get('/roster', async (req, res) => {
  res.json(await roster(await hallId()));
});

// Upload check ins saved on the phone, get the fresh list back
router.post('/sync', async (req, res) => {
  const eventId = await hallId();
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];

  for (const it of items) {
    const count = parseInt(it.people_count, 10);
    if (!it.client_id || !(count > 0)) continue;
    const method = ['qr', 'code', 'search', 'walkin'].includes(it.method) ? it.method : 'search';
    try {
      await query(
        `INSERT INTO checkins (client_id, invitation_id, event_id, people_count, method, walkin_name, staff_id, checked_in_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (client_id) DO NOTHING`,
        [
          it.client_id,
          method === 'walkin' ? null : it.invitation_id,
          eventId,
          count,
          method,
          method === 'walkin' ? String(it.walkin_name || 'Walk in').slice(0, 120) : null,
          req.staff.sub,
          it.checked_in_at || new Date().toISOString(),
        ]
      );
    } catch (err) {
      console.error('Skipped a check in:', err.message);
    }
  }

  res.json({ saved: items.length, ...(await roster(eventId)) });
});

export default router;