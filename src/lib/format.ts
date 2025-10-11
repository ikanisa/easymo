/**
 * ULTRA-MINIMAL WhatsApp Mobility - Formatting & URL Utilities
 * Pure functions for time, links, and message formatting
 */

/**
 * Format ISO timestamp to human readable "time ago"
 */
export function timeAgo(iso: string): string {
  const now = Date.now();
  const date = new Date(iso).getTime();
  const diffMs = now - date;
  
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Build WhatsApp chat link with message
 */
export function chatLink(phoneE164: string, text: string): string {
  const cleanPhone = phoneE164.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Build MoMo USSD tel link for payments
 */
export function momoTelLink(payee: string, amount: number): string {
  const cleanPayee = payee.replace(/[^0-9]/g, '');
  return `tel:*182*1*${cleanPayee}*${amount}%23`;
}

/**
 * Format phone number for display
 */
export function formatPhone(phoneE164: string): string {
  return phoneE164.replace(/^(\+250)(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4');
}

/**
 * Vehicle type display labels
 */
export const VEHICLE_LABELS: Record<string, string> = {
  moto: 'Moto Taxi',
  cab: 'Cab',
  lifan: 'Lifan',
  truck: 'Truck',
  others: 'Others'
};

/**
 * Status badge variants mapping
 */
export const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  pending_review: 'secondary',
  expired: 'outline',
  rejected: 'destructive',
  open: 'default',
  none: 'outline'
};