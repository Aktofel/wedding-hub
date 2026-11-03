import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireRole, pinInUse } from '../auth.js';
import { formatCode } from '../codes.js';
import { invitationLink, whatsappLink } from '../messages.js';

const router = Router();
router.use(requireRole('admin', 'coordinator'));

// Dashboard numbers per reception
router.get('/stats', async (req, res) => {
  const { rows } = await query(
    `SELECT e.code, e.name,
            count(ie.invitation_id)::int AS households,
            COALESCE(sum(i.max_party_size), 0)::int AS people_invited,
            count(*) FILTER (WHERE ie.rsvp_status = 'yes')::int AS yes_households,
            COALESCE(sum(ie.rsvp_count) FILTER (WHERE ie.rsvp_status = 'yes'), 0)::int AS people_coming,
            count(*) FILTER (WHERE ie.rsvp_status = 'no')::int AS declined,
            count(*) FILTER (WHERE ie.rsvp_status = 'pending')::int AS no_answer
       FROM events e
       LEFT JOIN invitation_events ie ON ie.event_id = e.id
       LEFT JOIN invitations i ON i.id = ie.invitation_id
      GROUP BY e.id
      ORDER BY e.id`
  );
  res.json(rows);
});

// Guest list with RSVP, table, link and WhatsApp send link
router.get('/invitations', async (req, res) => {
  const { rows } = await query(
    `SELECT i.id, i.household_name, i.contact_name, i.phone, i.max_party_size,
            i.side, i.vip, i.backup_code, i.token, i.last_sent_at, i.sent_channel,
            json_agg(json_build_object(
              'event', e.code, 'rsvp', ie.rsvp_status,
              'count', ie.rsvp_count, 'table', t.label
            ) ORDER BY e.id) AS events
       FROM invitations i
       JOIN invitation_events ie ON ie.invitation_id = i.id
       JOIN events e ON e.id = ie.event_id
       LEFT JOIN seating_tables t ON t.id = ie.table_id
      GROUP BY i.id
      ORDER BY i.household_name`
  );
  res.json(
    rows.map((inv) => ({
      ...inv,
      backup_code: formatCode(inv.backup_code),
      link: invitationLink(inv.token),
      whatsapp: whatsappLink(inv),
    }))
  );
});

// Mark an invitation as sent after pressing send in WhatsApp
router.post('/invitations/:id/sent', async (req, res) => {
  const channel = ['whatsapp', 'sms', 'print'].includes(req.body?.channel) ? req.body.channel : 'whatsapp';
  const result = await query(
    'UPDATE invitations SET last_sent_at = now(), sent_channel = $2 WHERE id = $1',
    [req.params.id, channel]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Invitation not found' });
  res.json({ ok: true });
});

// Add a coordinator or usher (admin only)
router.post('/staff', requireRole('admin'), async (req, res) => {
  const { name, role, pin } = req.body || {};
  if (!name || !['coordinator', 'usher', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Name and a valid role are required' });
  }
  if (!/^\d{6}$/.test(String(pin))) return res.status(400).json({ error: 'PIN must be 6 digits' });
  if (await pinInUse(pin)) return res.status(400).json({ error: 'That PIN is already taken' });

  const { rows } = await query(
    'INSERT INTO staff (name, role, pin_hash) VALUES ($1, $2, $3) RETURNING id, name, role',
    [name, role, await bcrypt.hash(String(pin), 10)]
  );
  res.status(201).json(rows[0]);
});

export default router;