// Shifts store a copy of the site name, so compare names loosely: "Kmart Wagga " and "kmart wagga" are the same site.
export function cleanSiteName(name) {
  return (name || "").trim().replace(/\s+/g, " ");
}

export function siteNameKey(name) {
  return cleanSiteName(name).toLowerCase();
}
