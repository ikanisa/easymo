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
