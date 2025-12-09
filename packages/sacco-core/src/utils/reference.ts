/**
 * Generate a unique payment reference
 * Format: YYYYMMDD-HHMMSS-RANDOM
 */
export function generatePaymentReference(): string {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const datePart = `${year}${month}${day}`;
  const timePart = `${hours}${minutes}${seconds}`;
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  return `${datePart}-${timePart}-${randomPart}`;
}

/**
 * Generate a member code
 * Format: SACCO-XXXXXX (6 random alphanumeric)
 */
export function generateMemberCode(saccoPrefix?: string): string {
  const prefix = saccoPrefix || 'MBR';
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

/**
 * Generate an Ikimina code
 * Format: IK-XXXXXX (6 random alphanumeric)
 */
export function generateIkiminaCode(): string {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `IK-${random}`;
}

/**
 * Generate a unique reference code
 * @param prefix - Prefix for the reference (e.g., "PAY", "TXN")
 * @param length - Length of random part (default: 8)
 * @returns Reference code (e.g., "PAY-ABC12345")
 */
export function generateReference(prefix: string = "REF", length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `${prefix}-${result}`;
}

/**
 * Validate reference format
 * @param reference - Reference string to validate
 * @param prefix - Expected prefix (optional)
 * @returns True if valid format
 */
export function isValidReference(reference: string, prefix?: string): boolean {
  const pattern = prefix 
    ? new RegExp(`^${prefix}-[A-Z0-9]{6,}$`)
    : /^[A-Z]{2,4}-[A-Z0-9]{6,}$/;
  
  return pattern.test(reference);
}
