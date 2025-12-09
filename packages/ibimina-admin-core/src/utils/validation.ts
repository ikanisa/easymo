// Placeholder for validation utilities
// Will be implemented in future phases

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Rwanda phone number validation (07X XXX XXXX)
  const phoneRegex = /^(07[2-9]\d{7}|25007[2-9]\d{7})$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function validateRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}
