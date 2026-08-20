/*
  India public holidays used to exclude non-working days when the app
  counts how many leave days a request covers (weekends are excluded
  automatically; these are added on top).

  Fixed national holidays for 2026 are pre-filled. Festival dates
  (Holi, Diwali, Eid, etc.) move every year and vary by region/state —
  add the ones your company observes using your official HR calendar
  before go-live. Format: "YYYY-MM-DD".
*/
window.INDIA_HOLIDAYS_2026 = [
  "2026-01-26", // Republic Day
  "2026-08-15", // Independence Day
  "2026-10-02", // Gandhi Jayanti
  "2026-12-25", // Christmas
  // TODO: add Holi, Diwali, Eid-ul-Fitr, Eid-ul-Adha, regional holidays, etc.
  // "2026-03-XX", // Holi
  // "2026-11-XX", // Diwali
];
