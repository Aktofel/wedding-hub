export function invitationLink(token) {
  return `${process.env.PUBLIC_BASE_URL}/i/${token}`;
}

export function invitationText(inv) {
  return [
    `Hello ${inv.contact_name || inv.household_name},`,
    '',
    `You are warmly invited to the wedding of ${process.env.COUPLE_NAMES}.`,
    '',
    'Your personal invitation, RSVP and entry pass:',
    invitationLink(inv.token),
    '',
    `Please RSVP by ${process.env.RSVP_DEADLINE}.`,
  ].join('\n');
}

export function whatsappLink(inv) {
  if (!inv.phone) return null;
  return `https://wa.me/${inv.phone}?text=${encodeURIComponent(invitationText(inv))}`;
}