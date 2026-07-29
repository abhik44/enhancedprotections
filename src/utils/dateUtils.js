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
  return d ? d.toLocaleDateString() : "-";
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
