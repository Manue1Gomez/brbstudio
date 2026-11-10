const AMOUNT_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

const toCents = (value) => Math.round(Number(value) * 100);

const fromCents = (cents) => cents / 100;

function parseAmountToCents(value) {
  const text = String(value ?? '').replace(/[₱,\s]/g, '');

  if (!AMOUNT_PATTERN.test(text)) return null;

  const cents = toCents(text);
  return cents > 0 ? cents : null;
}

module.exports = { toCents, fromCents, parseAmountToCents };
