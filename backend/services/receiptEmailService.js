const { isMailConfigured, sendMail } = require('../config/mail');
const studio = require('../config/studio');

const OUTCOME = Object.freeze({
  CONFIRMED: 'confirmed',
  RECEIVED: 'received',
  PARTIAL_DOWNPAYMENT: 'partial',
});

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  ));

const peso = (cents) =>
  `\u20B1${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function longDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function describeOutcome(data) {
  const paymentLabel = data.payment.type === 'Downpayment' ? 'downpayment' : 'payment';
  const amount = peso(data.payment.amountCents);

  if (data.outcome === OUTCOME.CONFIRMED) {
    return {
      subject: `Booking confirmed - #${data.reference} | ${studio.name}`,
      heading: 'Your booking is confirmed',
      intro: `We have verified your ${paymentLabel} of ${amount}. Your schedule is now reserved for you.`,
    };
  }

  if (data.outcome === OUTCOME.PARTIAL_DOWNPAYMENT) {
    return {
      subject: `Payment received - #${data.reference} | ${studio.name}`,
      heading: 'Payment received',
      intro: `We have verified your payment of ${amount}. Your booking will be confirmed once the 50% downpayment of ${peso(data.requiredDownpaymentCents)} is complete.`,
    };
  }

  return {
    subject: `Payment received - #${data.reference} | ${studio.name}`,
    heading: data.balanceCents === 0 ? 'Payment received. You are fully paid' : 'Payment received',
    intro: `We have verified your ${paymentLabel} of ${amount}. Thank you!`,
  };
}

function balanceMessage(data) {
  if (data.balanceCents === 0) return 'Your booking is fully paid. No remaining balance.';

  return `Please settle the remaining balance of ${peso(data.balanceCents)} on or before your event date, through GCash or in cash at the studio.`;
}

function buildLines(data) {
  const lines = [
    ['Booking reference', `#${data.reference}`],
    ['Approved event date', longDate(data.eventDate)],
    ['Time', data.timeLabel],
  ];

  if (data.address) lines.push(['Event address', data.address]);

  return lines;
}

function buildText(data, copy) {
  const lines = [
    `Hi ${data.customerFirstName},`,
    '',
    copy.heading.toUpperCase(),
    copy.intro,
    '',
    ...buildLines(data).map(([label, value]) => `${label}: ${value}`),
    '',
    'SERVICES',
    ...data.services.map((service) => `- ${service.name}: ${peso(service.priceCents)}`),
    '',
    `Subtotal: ${peso(data.subtotalCents)}`,
  ];

  if (data.discountCents > 0) {
    lines.push(`Discount${data.voucherCode ? ` (${data.voucherCode})` : ''}: -${peso(data.discountCents)}`);
  }

  lines.push(
    `Total: ${peso(data.totalCents)}`,
    '',
    'PAYMENT RECEIVED',
    `Amount: ${peso(data.payment.amountCents)} via ${data.payment.method}`,
    ...(data.payment.referenceNumber ? [`Reference no.: ${data.payment.referenceNumber}`] : []),
    `Total paid so far: ${peso(data.paidCents)}`,
    `Remaining balance: ${peso(data.balanceCents)}`,
    '',
    balanceMessage(data),
    '',
    'This email is your e-receipt. Please keep it for your records.',
    '',
    studio.name,
    studio.address,
    `${studio.phone} | ${studio.email}`
  );

  return lines.join('\n');
}

function htmlRow(label, value, { strong = false, muted = false } = {}) {
  const weight = strong ? 'font-weight:700;' : '';
  const color = muted ? 'color:#6b6b70;' : 'color:#222125;';

  return `<tr>
    <td style="padding:6px 0;font-size:14px;color:#6b6b70;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-size:14px;text-align:right;${weight}${color}">${escapeHtml(value)}</td>
  </tr>`;
}

function buildHtml(data, copy) {
  const detailRows = buildLines(data).map(([label, value]) => htmlRow(label, value)).join('');
  const serviceRows = data.services.map((service) => htmlRow(service.name, peso(service.priceCents))).join('');
  const discountRow =
    data.discountCents > 0
      ? htmlRow(`Discount${data.voucherCode ? ` (${data.voucherCode})` : ''}`, `-${peso(data.discountCents)}`)
      : '';
  const referenceRow = data.payment.referenceNumber ? htmlRow('Reference no.', data.payment.referenceNumber) : '';

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;">
    <tr><td style="background:#222125;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px;">${escapeHtml(studio.name)}</td></tr>
    <tr><td style="padding:28px;">
      <p style="margin:0 0 6px;font-size:15px;color:#222125;">Hi ${escapeHtml(data.customerFirstName)},</p>
      <h1 style="margin:0 0 10px;font-size:22px;color:#b8262a;">${escapeHtml(copy.heading)}</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#222125;">${escapeHtml(copy.intro)}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e4e8;">${detailRows}</table>

      <p style="margin:20px 0 4px;font-size:12px;letter-spacing:1.5px;color:#6b6b70;">SERVICES</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e4e8;">
        ${serviceRows}
        ${htmlRow('Subtotal', peso(data.subtotalCents))}
        ${discountRow}
        ${htmlRow('Total', peso(data.totalCents), { strong: true })}
      </table>

      <p style="margin:20px 0 4px;font-size:12px;letter-spacing:1.5px;color:#6b6b70;">PAYMENT RECEIVED</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e4e8;">
        ${htmlRow('Amount', `${peso(data.payment.amountCents)} via ${data.payment.method}`, { strong: true })}
        ${referenceRow}
        ${htmlRow('Total paid so far', peso(data.paidCents))}
        ${htmlRow('Remaining balance', peso(data.balanceCents), { strong: true })}
      </table>

      <p style="margin:20px 0 0;padding:12px 14px;background:#fff4f3;border-left:3px solid #d03c3b;font-size:14px;line-height:1.5;color:#222125;">${escapeHtml(balanceMessage(data))}</p>
      <p style="margin:20px 0 0;font-size:12px;color:#6b6b70;">This email is your e-receipt. Please keep it for your records.</p>
    </td></tr>
    <tr><td style="background:#f4f4f6;padding:18px 28px;font-size:12px;line-height:1.6;color:#6b6b70;">
      ${escapeHtml(studio.name)}<br>${escapeHtml(studio.address)}<br>${escapeHtml(studio.phone)} &middot; ${escapeHtml(studio.email)}
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendPaymentReceipt(data) {
  const to = data.customerEmail;

  if (!isMailConfigured()) {
    console.warn('E-receipt not sent: email is not set up (MAIL_HOST is missing in .env).');
    return { status: 'not_configured', to };
  }

  const copy = describeOutcome(data);

  try {
    await sendMail({ to, subject: copy.subject, text: buildText(data, copy), html: buildHtml(data, copy) });
    return { status: 'sent', to };
  } catch (error) {
    console.error(`E-receipt to ${to} failed: ${error.message}`);
    return { status: 'failed', to };
  }
}

module.exports = { OUTCOME, sendPaymentReceipt };
