// ✅ BULLETPROOF DATE PARSER
export function parseDate(value) {
  if (!value) return null;

  // Firestore Timestamp
  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }

  if (value?.toDate) {
    return value.toDate();
  }

  // JS Date
  if (value instanceof Date) {
    return value;
  }

  // STRING FORMATS
  if (typeof value === "string") {
    // DD/MM/YYYY (kept for legacy data; shift `date` is normally ISO YYYY-MM-DD)
    if (value.includes("/")) {
      const [day, month, year] = value.split("/").map(Number);
      if (day && month && year) {
        return new Date(year, month - 1, day);
      }
    }

    // fallback
    const d = new Date(value);
    if (!isNaN(d)) return d;
  }

  return null;
}

export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function isDateWithinRange(value, start, end) {
  if (!start || !end) return true;

  const d = parseDate(value);
  if (!d) return false;

  const sd = new Date(d);
  sd.setHours(0, 0, 0, 0);

  const s = new Date(start);
  s.setHours(0, 0, 0, 0);

  const e = new Date(end);
  e.setHours(0, 0, 0, 0);

  return sd >= s && sd <= e;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isoDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Standard ISO-8601 week number. `year` is the ISO week-year, which can
// differ from the calendar year for dates in the last/first days of Dec/Jan.
export function getIsoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);

  return { year: d.getUTCFullYear(), week };
}
