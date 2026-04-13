
export const parseToDate = (timeStr) => {
  if (!timeStr) return null;

  if (timeStr instanceof Date) return timeStr;

  const s = String(timeStr).trim().toLowerCase();

  
  const ampmMatch = s.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2] || "0", 10);
    const period = ampmMatch[3].toLowerCase();
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  
  const hhmmMatch = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = parseInt(hhmmMatch[1], 10);
    const minutes = parseInt(hhmmMatch[2], 10);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  return null; 
};

export const formatToAmPm = (timeStr) => {
  const d = parseToDate(timeStr);
  if (!d) return ""; 
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${hours}:${mm} ${ampm}`;
};
