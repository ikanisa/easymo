/**
 * Unified Admin/Support Contact Fetching
 * Single source of truth for all admin/support contact information
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

export interface AdminContact {
  id: string;
  channel: string;
  destination: string;
  display_name: string;
  category?: string;
  display_order?: number;
}

type ContactCategory = 'support' | 'admin_auth' | 'insurance' | 'general' | 'escalation';

/**
 * Fetch admin/support contacts from insurance_admin_contacts table
 * This is the ONLY place to get admin/support contact information
 */
export async function getAdminContacts(
  supabase: SupabaseClient,
  options: {
    category?: ContactCategory;
    channel?: 'whatsapp' | 'email' | 'phone' | 'sms';
    activeOnly?: boolean;
  } = {}
): Promise<AdminContact[]> {
  const { category, channel, activeOnly = true } = options;

  let query = supabase
    .from('insurance_admin_contacts')
    .select('id, channel, destination, display_name, category, display_order');

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (channel) {
    query = query.eq('channel', channel);
  }

  query = query.order('priority', { ascending: true })
               .order('display_order', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('get_admin_contacts_error', error);
    return [];
  }

  return data || [];
}

/**
 * Get admin numbers for authentication (replaces hardcoded DEFAULT_ADMIN_NUMBERS)
 */
export async function getAdminAuthNumbers(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const contacts = await getAdminContacts(supabase, {
    category: 'admin_auth',
    channel: 'whatsapp',
  });

  const numbers = new Set<string>();
  
  for (const contact of contacts) {
    // Normalize phone number
    const normalized = normalizePhone(contact.destination);
    if (normalized) {
      numbers.add(normalized);
    }
  }

  return numbers;
}

/**
 * Build WhatsApp contact message with clickable links
 */
export function buildContactMessage(
  contacts: AdminContact[],
  options: {
    title?: string;
    includeAI?: boolean;
    footer?: string;
  } = {}
): string {
  const {
    title = '🆘 *Help & Support*',
    includeAI = false,
    footer = '_Tap any link above to start chatting on WhatsApp._'
  } = options;

  if (contacts.length === 0) {
    return `${title}\n\n` +
           'Contact our team:\n\n' +
           '📧 Email: support@easymo.rw\n' +
           '🌐 Website: www.easymo.rw';
  }

  let message = `${title}\n\n`;
  message += 'Contact our team for assistance:\n\n';

  const whatsappContacts = contacts.filter(c => c.channel === 'whatsapp');
  const otherContacts = contacts.filter(c => c.channel !== 'whatsapp');

  // WhatsApp contacts with clickable links
  if (whatsappContacts.length > 0) {
    whatsappContacts.forEach((contact) => {
      const cleanNumber = contact.destination.replace(/[^0-9]/g, '');
      const waLink = `https://wa.me/${cleanNumber}`;
      message += `• *${contact.display_name}*\n  ${waLink}\n\n`;
    });
  }

  // Other contact types
  if (otherContacts.length > 0) {
    message += '\n📞 *Other Contacts:*\n';
    otherContacts.forEach((contact) => {
      const icon = contact.channel === 'email' ? '📧' :
                   contact.channel === 'phone' ? '📞' :
                   contact.channel === 'sms' ? '💬' : '📞';
      message += `${icon} ${contact.display_name}: ${contact.destination}\n`;
    });
  }

  if (footer) {
    message += `\n${footer}`;
  }

  if (includeAI) {
    message += '\n\nOr chat with our AI assistant for immediate help.';
  }

  return message;
}

/**
 * Get support contact info for error messages
 * Returns a formatted string to append to error messages
 */
export async function getSupportContactString(
  supabase: SupabaseClient,
  category: ContactCategory = 'support'
): Promise<string> {
  const contacts = await getAdminContacts(supabase, {
    category,
    channel: 'whatsapp',
  });

  if (contacts.length === 0) {
    return 'support@easymo.rw';
  }

  // Get first contact's clean number
  const firstContact = contacts[0];
  const cleanNumber = firstContact.destination.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanNumber}`;
}

/**
 * Normalize phone number to consistent format
 */
function normalizePhone(value: string): string {
  if (!value) return value;
  let s = value.trim();
  if (!s) return s;
  
  // Remove all non-digit characters
  const digits = s.replace(/[^0-9]/g, '');
  
  // Add + prefix if not present
  if (!s.startsWith('+')) {
    if (digits.startsWith('250') || digits.startsWith('356')) {
      return `+${digits}`;
    } else if (digits.startsWith('0') && digits.length === 10) {
      // Rwanda local format (0788...) -> +250788...
      return `+250${digits.slice(1)}`;
    }
    return `+${digits}`;
  }
  
  return s;
}
