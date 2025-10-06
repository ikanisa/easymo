export function formatISO(date: Date): string {
  return date.toISOString();
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function subDays(date: Date, amount: number): Date {
  return addDays(date, -amount);
}
