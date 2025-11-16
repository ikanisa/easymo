// Common utility functions

export function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-3);
}

export function formatCurrency(amount: number, currency = "RWF"): string {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateId(prefix = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}
