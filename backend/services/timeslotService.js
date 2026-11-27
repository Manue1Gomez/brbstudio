const { formatMinutes, timeTextToMinutes } = require('./timeHelper');

function generateSlots({ open, close, durationHours, busyIntervals = [], nowMinutes = null }) {
  if (!Number.isInteger(durationHours) || durationHours < 1) {
    throw new TypeError('durationHours must be a positive whole number.');
  }

  const opens = typeof open === 'number' ? open : timeTextToMinutes(open);
  const closes = typeof close === 'number' ? close : timeTextToMinutes(close);
  if (opens < 0 || closes > 24 * 60 || closes <= opens) {
    throw new TypeError('Opening and closing times must define a valid same-day range.');
  }

  const durationMinutes = durationHours * 60;
  const slots = [];

  for (let start = Math.ceil(opens / 60) * 60; start + durationMinutes <= closes; start += 60) {
    const end = start + durationMinutes;
    if (nowMinutes !== null && start <= nowMinutes) continue;
    if (busyIntervals.some((busy) => start < busy.end && end > busy.start)) continue;

    const startTime = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
    const endTime = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    slots.push({
      startTime,
      endTime,
      label: `${formatMinutes(start)} - ${formatMinutes(end)}`,
    });
  }

  return slots;
}

module.exports = { generateSlots };
