// Canonical worked-hours math for shift clockin/clockout/breaks.
// clockin/clockout/break start-end are plain "HH:mm" 24h strings, "0" = not set.

export function timeToMinutes(hhmm) {
  if (!hhmm || hhmm === "0") return null;

  const match = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  return h * 60 + m;
}

export function spanMinutes(start, end) {
  const startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (startMin == null || endMin == null) return null;

  // handle overnight rollover
  if (endMin < startMin) {
    endMin += 24 * 60;
  }

  return endMin - startMin;
}

export function sumBreakMinutes(breaks) {
  if (!Array.isArray(breaks)) return 0;

  return breaks.reduce((total, b) => {
    if (!b || b.end === "0" || b.end == null) return total;
    const span = spanMinutes(b.start, b.end);
    return span ? total + span : total;
  }, 0);
}

export function calculateWorkedMinutes(clockin, clockout, breaks) {
  const shiftSpan = spanMinutes(clockin, clockout);
  if (shiftSpan == null) return null;

  const breakMinutes = sumBreakMinutes(breaks);
  return Math.max(0, shiftSpan - breakMinutes);
}

export function formatMinutes(totalMinutes) {
  if (totalMinutes == null || Number.isNaN(totalMinutes)) return "-";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function calculateWorkedHours(clockin, clockout, breaks) {
  try {
    return formatMinutes(calculateWorkedMinutes(clockin, clockout, breaks));
  } catch {
    return "-";
  }
}
