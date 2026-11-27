const { isMailConfigured, sendMail } = require('../config/mail');
const { BOOKING_STATUS, RESCHEDULE_STATUS } = require('../config/bookingStatus');
const studio = require('../config/studio');
const bookingManagementModel = require('../models/bookingManagementModel');
const { requiredDownpaymentCents } = require('./paymentRules');
const { toCents } = require('./money');
const { formatTimeRange, timeTextToMinutes } = require('./timeHelper');

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

function peso(cents) {
  return `\u20B1${(cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getFirstName(booking) {
  return String(booking.customerName ?? '').trim().split(/\s+/)[0] || 'there';
}

function getSchedule(booking) {
  return `${longDate(booking.eventDate)}, ${formatTimeRange(
    timeTextToMinutes(booking.startTime),
    timeTextToMinutes(booking.endTime)
  )}`;
}

function buildMessage({ to, firstName, subject, heading, intro, details }) {
  const text = [
    `Hi ${firstName},`,
    '',
    heading,
    intro,
    '',
    ...details.map(([label, value]) => `${label}: ${value}`),
    '',
    studio.name,
    studio.address,
    `${studio.phone} | ${studio.email}`,
  ].join('\n');
  const rows = details.map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;color:#6b6b70;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;text-align:right;color:#222125;font-weight:600;">${escapeHtml(value)}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;">
    <tr><td style="background:#222125;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700;">${escapeHtml(studio.name)}</td></tr>
    <tr><td style="padding:28px;color:#222125;">
      <p>Hi ${escapeHtml(firstName)},</p>
      <h1 style="font-size:22px;color:#b8262a;">${escapeHtml(heading)}</h1>
      <p style="font-size:14px;line-height:1.6;">${escapeHtml(intro)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e4e8;">${rows}</table>
    </td></tr>
    <tr><td style="background:#f4f4f6;padding:18px 28px;font-size:12px;line-height:1.6;color:#6b6b70;">
      ${escapeHtml(studio.name)}<br>${escapeHtml(studio.address)}<br>${escapeHtml(studio.phone)} &middot; ${escapeHtml(studio.email)}
    </td></tr>
  </table>
</body>
</html>`;

  return { to, subject, text, html };
}

function buildBookingDecisionEmail({ booking, status, downpaymentCents }) {
  const accepted = status === BOOKING_STATUS.TO_PAY;
  if (!accepted && status !== BOOKING_STATUS.REJECTED) {
    throw new Error('Booking decision email requires an accepted or rejected status.');
  }

  const reference = `#${booking.reference}`;
  const schedule = getSchedule(booking);
  const firstName = getFirstName(booking);
  const downpayment = accepted ? peso(downpaymentCents) : null;

  return buildMessage({
    to: booking.customerEmail,
    firstName,
    subject: accepted
      ? `Booking request accepted - ${reference} | ${studio.name}`
      : `Booking request update - ${reference} | ${studio.name}`,
    heading: accepted ? 'Your booking request has been accepted' : 'Your booking request was not approved',
    intro: accepted
      ? `Please pay the 50% downpayment of ${downpayment} through the GCash option or upload your payment proof in My Bookings. Your booking will be confirmed after the downpayment is verified.`
      : 'Unfortunately, we are unable to approve your booking request. Please contact the studio if you have any questions.',
    details: [
      ['Booking reference', reference],
      ['Requested schedule', schedule],
      ...(accepted ? [['Downpayment due', downpayment]] : []),
    ],
  });
}

function buildRescheduleDecisionEmail({
  booking,
  status,
  requestedDate,
  requestedStartTime,
  requestedEndTime,
}) {
  const approved = status === RESCHEDULE_STATUS.APPROVED;
  if (!approved && status !== RESCHEDULE_STATUS.REJECTED) {
    throw new Error('Reschedule decision email requires an approved or rejected status.');
  }

  const reference = `#${booking.reference}`;
  const currentSchedule = getSchedule(booking);
  const requestedSchedule = `${longDate(requestedDate)}, ${formatTimeRange(
    timeTextToMinutes(requestedStartTime),
    timeTextToMinutes(requestedEndTime)
  )}`;

  return buildMessage({
    to: booking.customerEmail,
    firstName: getFirstName(booking),
    subject: approved
      ? `Reschedule request approved - ${reference} | ${studio.name}`
      : `Reschedule request update - ${reference} | ${studio.name}`,
    heading: approved ? 'Your reschedule request was approved' : 'Your reschedule request was not approved',
    intro: approved
      ? 'Your booking has been moved to the approved schedule below.'
      : 'Your reschedule request could not be approved. Your booking remains at its current schedule.',
    details: [
      ['Booking reference', reference],
      ...(approved
        ? [['New schedule', currentSchedule]]
        : [
            ['Current schedule', currentSchedule],
            ['Requested schedule', requestedSchedule],
          ]),
    ],
  });
}

async function sendBookingNotification(bookingId, purpose, build) {
  let booking;
  try {
    booking = await bookingManagementModel.findDetails(bookingId);
  } catch (error) {
    console.error(`Could not prepare the ${purpose} email: ${error.message}`);
    return { status: 'failed', to: null };
  }

  if (!booking) {
    console.error(`Could not prepare the ${purpose} email: booking ${bookingId} was not found.`);
    return { status: 'failed', to: null };
  }

  const message = build(booking);
  const to = message.to;
  if (!isMailConfigured()) {
    console.warn(`${purpose} email not sent: email is not set up (MAIL_HOST is missing in .env).`);
    return { status: 'not_configured', to };
  }

  try {
    await sendMail(message);
    return { status: 'sent', to };
  } catch (error) {
    console.error(`${purpose} email to ${to} failed: ${error.message}`);
    return { status: 'failed', to };
  }
}

async function sendBookingDecisionEmail({ bookingId, status }) {
  return sendBookingNotification(bookingId, 'Booking decision', (booking) => {
    const downpaymentCents = status === BOOKING_STATUS.TO_PAY
      ? requiredDownpaymentCents(toCents(booking.totalAmount))
      : null;
    return buildBookingDecisionEmail({ booking, status, downpaymentCents });
  });
}

async function sendRescheduleDecisionEmail({ bookingId, status, requestedDate, requestedStartTime, requestedEndTime }) {
  return sendBookingNotification(bookingId, 'Reschedule decision', (booking) =>
    buildRescheduleDecisionEmail({
      booking,
      status,
      requestedDate,
      requestedStartTime,
      requestedEndTime,
    })
  );
}

module.exports = {
  buildBookingDecisionEmail,
  buildRescheduleDecisionEmail,
  sendBookingDecisionEmail,
  sendRescheduleDecisionEmail,
};
