export function monthKeyFromDate(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function startOfMonthISO(now = new Date()) {
  const dt = new Date(now);
  dt.setDate(1);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString();
}