/**
 * Validation Utilities
 * Functions for validating user input
 */

/**
 * Validate phone number
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const cleaned = phone.replace(/\D/g, '');
  
  // Rwanda phone numbers should be 12 digits with country code (250)
  if (cleaned.startsWith('250')) {
    if (cleaned.length !== 12) {
      return { valid: false, error: 'Rwanda phone number must be 12 digits including country code' };
    }
    // Validate Rwanda mobile prefixes (78, 79, 72, 73)
    const prefix = cleaned.substring(3, 5);
    if (!['78', '79', '72', '73'].includes(prefix)) {
      return { valid: false, error: 'Invalid Rwanda mobile number prefix' };
    }
    return { valid: true };
  }
  
  // Other phone numbers should be at least 10 digits
  if (cleaned.length < 10) {
    return { valid: false, error: 'Phone number must be at least 10 digits' };
  }
  
  return { valid: true };
}

/**
 * Validate national ID
 */
export function validateNationalId(id: string): { valid: boolean; error?: string } {
  const cleaned = id.replace(/\s/g, '');
  
  // Rwanda national IDs are 16 digits
  if (!/^\d{16}$/.test(cleaned)) {
    return { valid: false, error: 'National ID must be 16 digits' };
  }
  
  return { valid: true };
}

/**
 * Validate email
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email address' };
  }
  
  return { valid: true };
}

/**
 * Validate amount (positive number)
 */
export function validateAmount(amount: string | number): { valid: boolean; error?: string } {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) {
    return { valid: false, error: 'Amount must be a number' };
  }
  
  if (num <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }
  
  return { valid: true };
}

/**
 * Validate required field
 */
export function validateRequired(value: string | number | null | undefined): { valid: boolean; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: 'This field is required' };
  }
  
  return { valid: true };
}

/**
 * Validate minimum length
 */
export function validateMinLength(value: string, minLength: number): { valid: boolean; error?: string } {
  if (value.length < minLength) {
    return { valid: false, error: `Must be at least ${minLength} characters` };
  }
  
  return { valid: true };
}

/**
 * Validate maximum length
 */
export function validateMaxLength(value: string, maxLength: number): { valid: boolean; error?: string } {
  if (value.length > maxLength) {
    return { valid: false, error: `Must be at most ${maxLength} characters` };
  }
  
  return { valid: true };
}

/**
 * Compose multiple validators
 */
export function composeValidators(
  ...validators: Array<(value: unknown) => { valid: boolean; error?: string }>
) {
  return (value: unknown) => {
    for (const validator of validators) {
      const result = validator(value);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  };
}
