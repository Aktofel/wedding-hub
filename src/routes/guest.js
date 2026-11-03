import { Router } from 'express';
import QRCode from 'qrcode';
import { query } from '../db.js';
import { formatCode, qrPayload } from '../codes.js';

const router = Router();

async function loadInvitation(token) {
  const { rows } = await query(
    `SELECT id, household_name, contact_name, max_party_size, backup_code, language
       FROM invitations WHERE token = $1`,
    [token]
  );
  return rows[0];
}

// Invitation page data: names, events, RSVP state, table, pass
router.get('/:token', async (req, res) => {
  const inv = await loadInvitation(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invitation not found' });

  const { rows: events } = await query(
    `SELECT e.code, e.name, e.venue, e.address, e.map_link, e.starts_at,
            ie.rsvp_status, ie.rsvp_count, t.label AS table_label
       FROM invitation_events ie
       JOIN events e ON e.id = ie.event_id
       LEFT JOIN seating_tables t ON t.id = ie.table_id
      WHERE ie.invitation_id = $1
      ORDER BY e.starts_at NULLS LAST, e.id`,
    [inv.id]
  );

  res.json({
    household: inv.household_name,
    contact: inv.contact_name,
    maxPartySize: inv.max_party_size,
    language: inv.language,
    pass: {
      backupCode: formatCode(inv.backup_code),
      qrUrl: `/api/i/${req.params.token}/qr.png`,
    },
    events,
  });
});

// QR image for the guest pass
router.get('/:token/qr.png', async (req, res) => {
  const inv = await loadInvitation(req.params.token);
  if (!inv) return res.status(404).end();
  const png = await QRCode.toBuffer(qrPayload(req.params.token), {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
  });
  res.type('png').set('Cache-Control', 'private, max-age=86400').send(png);
});

// RSVP per event: { event: 'hall', status: 'yes', count: 3, note: '' }
router.post('/:token/rsvp', async (req, res) => {
  const inv = await loadInvitation(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Invitation not found' });

  const { event, status, count, note } = req.body || {};
  if (!['yes', 'no'].includes(status)) {
    return res.status(400).json({ error: 'Choose yes or no' });
  }
  const n = status === 'yes' ? parseInt(count, 10) : 0;
  if (status === 'yes' && !(n >= 1 && n <= inv.max_party_size)) {
    return res.status(400).json({ error: `Number coming must be between 1 and ${inv.max_party_size}` });
  }

  const result = await query(
    `UPDATE invitation_events ie
        SET rsvp_status = $3, rsvp_count = $4, rsvp_note = $5, responded_at = now()
       FROM events e
      WHERE ie.event_id = e.id AND ie.invitation_id = $1 AND e.code = $2`,
    [inv.id, event, status, n, note ? String(note).slice(0, 500) : null]
  );
  if (!result.rowCount) return res.status(400).json({ error: 'You are not invited to that event' });
  res.json({ ok: true });
});

export default router;