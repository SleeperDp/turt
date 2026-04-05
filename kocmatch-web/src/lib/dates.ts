export function startOfWeekMonday(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0=Sun ... 6=Sat
  const diff = (day + 6) % 7; // days since Monday
  date.setDate(date.getDate() - diff);
  return date;
}

export function addDays(d: Date, days: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

