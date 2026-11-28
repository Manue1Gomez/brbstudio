const pad = (value) => String(value).padStart(2, '0');

const longDateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export function fromIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const formatLongDate = (isoDate) => longDateFormat.format(fromIsoDate(isoDate));

export function formatPeso(amount) {
  const value = Number(amount);
  const decimals = Number.isInteger(value) ? 0 : 2;

  return `₱ ${value.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatTime(timeText) {
  const [hours, minutes] = timeText.split(':').map(Number);
  const meridiem = hours >= 12 ? 'PM' : 'AM';

  return `${pad(hours % 12 || 12)}:${pad(minutes)} ${meridiem}`;
}
