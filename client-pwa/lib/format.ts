export function formatPrice(amount: number, currency: string = 'RWF'): string {
  const currencySymbols: Record<string, string> = {
    RWF: 'RWF',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };

  const symbol = currencySymbols[currency] || currency;
  
  if (currency === 'RWF') {
    // Format RWF without decimals
    return `${amount.toLocaleString('en-RW')} ${symbol}`;
  }

  // Format other currencies with 2 decimals
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
