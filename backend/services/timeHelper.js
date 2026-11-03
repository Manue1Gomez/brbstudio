// Booking.Time_Slot is stored as a range, e.g. "9:00 AM - 12:00 PM" or "09:00:00 - 12:00:00".
const TIME_PATTERN = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/gi;

function toMinutes(hours, minutes, meridiem) {
  let h = Number(hours);

  if (meridiem) {
    if (h === 12) h = 0;
    if (meridiem.toUpperCase() === 'PM') h += 12;
  }

  return h * 60 + Number(minutes);
}

// Returns { start, end } in minutes after midnight, or null when the value can't be read.
function parseTimeSlot(timeSlot) {
  if (!timeSlot) return null;

  const matches = [...String(timeSlot).matchAll(TIME_PATTERN)];
  if (matches.length < 2) return null;

  const [start, end] = matches.map(([, h, m, meridiem]) => toMinutes(h, m, meridiem));
  return end > start ? { start, end } : null;
}

// 540 -> "9:00 AM"
function formatMinutes(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${minutes} ${meridiem}`;
}

// Local calendar date as YYYY-MM-DD.
function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}

module.exports = { parseTimeSlot, formatMinutes, todayIso };
