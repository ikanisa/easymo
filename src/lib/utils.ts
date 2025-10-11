import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a ref code to ensure it's displayed as 6 digits with leading zeros if needed
 * @param refCode - The reference code to format
 * @returns A 6-digit string with leading zeros if necessary
 */
export function formatUserRefCode(refCode: string | number): string {
  return String(refCode).padStart(6, '0');
}
