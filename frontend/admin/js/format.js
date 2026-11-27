const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const longDateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export function fromIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const formatDate = (isoDate) => dateFormat.format(fromIsoDate(isoDate));

export const formatLongDate = (isoDate) => longDateFormat.format(fromIsoDate(isoDate));

export function formatDateTime(sqlDateTime) {
  const [datePart, timePart] = sqlDateTime.split(' ');
  const [hours, minutes] = timePart.split(':').map(Number);
  const date = fromIsoDate(datePart);
  date.setHours(hours, minutes);

  return `${dateFormat.format(date)}, ${timeFormat.format(date)}`;
}

export function formatPeso(amount) {
  const value = Number(amount);
  const decimals = Number.isInteger(value) ? 0 : 2;

  return `\u20B1${value.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export const statusSlug = (status) => status.toLowerCase().replace(/\s+/g, '-');
