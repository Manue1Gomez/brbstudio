const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatMinutes(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${minutes} ${meridiem}`;
}

function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function todayIso() {
  return toIsoDate(new Date());
}

function isValidIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value ?? '')) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function timeTextToMinutes(text) {
  const [hours, minutes] = text.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTimeRange(startMinutes, endMinutes) {
  return `${formatMinutes(startMinutes)} - ${formatMinutes(endMinutes)}`;
}

module.exports = {
  formatMinutes,
  formatTimeRange,
  timeTextToMinutes,
  toIsoDate,
  todayIso,
  isValidIsoDate,
};
