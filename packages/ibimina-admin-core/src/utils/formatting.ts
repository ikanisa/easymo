// Placeholder for formatting utilities
// Will be implemented in future phases

export function formatCurrency(amount: number, currency = 'RWF'): string {
  return new Intl.NumberFormat('rw-RW', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string, format = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (format === 'short') {
    return new Intl.DateTimeFormat('rw-RW').format(d);
  }
  return new Intl.DateTimeFormat('rw-RW', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}

export function formatPhone(phone: string): string {
  // Format as: 07X XXX XXXX
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('07')) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}
