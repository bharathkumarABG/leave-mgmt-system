/*
  Counts leave days between two dates (inclusive), excluding weekends
  and the configured India public holidays.
*/
function countLeaveDays(startDateStr, endDateStr) {
  const holidays = new Set(window.INDIA_HOLIDAYS_2026 || []);
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDateStr + "T00:00:00");
  if (isNaN(start) || isNaN(end) || end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay(); // 0 = Sunday, 6 = Saturday
    const iso = cur.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidays.has(iso)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
