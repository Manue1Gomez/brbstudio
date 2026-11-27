const { isMailConfigured, sendMail } = require('../config/mail');
const studio = require('../config/studio');
const bookingManagementModel = require('../models/bookingManagementModel');

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  ));

function longDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function sendWorkshopRescheduleEmail({ bookingId, oldEventDate }) {
  let booking;

  try {
    booking = await bookingManagementModel.findDetails(bookingId);
  } catch (error) {
    console.error(`Could not prepare the workshop reschedule email: ${error.message}`);
    return { status: 'failed', to: null };
  }

  if (!booking) {
    console.error(`Could not prepare the workshop reschedule email: booking ${bookingId} was not found.`);
    return { status: 'failed', to: null };
  }

  const to = booking.customerEmail;
  if (!isMailConfigured()) {
    console.warn('Workshop reschedule email not sent: email is not set up (MAIL_HOST is missing in .env).');
    return { status: 'not_configured', to };
  }

  const oldDate = longDate(oldEventDate);
  const newDate = longDate(booking.eventDate);
  const firstName = String(booking.customerName ?? '').trim().split(/\s+/)[0] || 'there';
  const subject = `Modeling Workshop rescheduled - #${booking.reference} | ${studio.name}`;
  const text = [
    `Hi ${firstName},`,
    '',
    'Your Modeling Workshop has been rescheduled.',
    `Booking reference: #${booking.reference}`,
    `Previous date: ${oldDate}`,
    `New date: ${newDate}`,
    'The workshop is scheduled for the full day.',
    '',
    studio.name,
    studio.address,
    `${studio.phone} | ${studio.email}`,
  ].join('\n');
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;">
    <tr><td style="background:#222125;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">${escapeHtml(studio.name)}</td></tr>
    <tr><td style="padding:28px;color:#222125;">
      <p>Hi ${escapeHtml(firstName)},</p>
      <h1 style="font-size:22px;color:#b8262a;">Your Modeling Workshop has been rescheduled</h1>
      <p>Booking reference: #${escapeHtml(booking.reference)}</p>
      <p>Previous date: ${escapeHtml(oldDate)}</p>
      <p>New date: <strong>${escapeHtml(newDate)}</strong></p>
      <p>The workshop is scheduled for the full day.</p>
    </td></tr>
    <tr><td style="background:#f4f4f6;padding:18px 28px;font-size:12px;line-height:1.6;color:#6b6b70;">
      ${escapeHtml(studio.name)}<br>${escapeHtml(studio.address)}<br>${escapeHtml(studio.phone)} &middot; ${escapeHtml(studio.email)}
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await sendMail({ to, subject, text, html });
    return { status: 'sent', to };
  } catch (error) {
    console.error(`Workshop reschedule email to ${to} failed: ${error.message}`);
    return { status: 'failed', to };
  }
}

module.exports = { sendWorkshopRescheduleEmail };
