/**
 * Message Types
 * WhatsApp message type definitions
 */

// ============================================================================
// INCOMING MESSAGES
// ============================================================================

/**
 * Base WhatsApp message
 */
export type WhatsAppMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: MessageType;
};

/**
 * Message type enum
 */
export type MessageType = 
  | "text"
  | "interactive"
  | "location"
  | "image"
  | "document"
  | "audio"
  | "video"
  | "sticker"
  | "contacts"
  | "unknown";

/**
 * Text message
 */
export type TextMessage = WhatsAppMessage & {
  type: "text";
  text: {
    body: string;
  };
};

/**
 * Interactive message (button/list reply)
 */
export type InteractiveMessage = WhatsAppMessage & {
  type: "interactive";
  interactive: {
    type: "button_reply" | "list_reply";
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
};

/**
 * Location message
 */
export type LocationMessage = WhatsAppMessage & {
  type: "location";
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
};

/**
 * Image message
 */
export type ImageMessage = WhatsAppMessage & {
  type: "image";
  image: {
    id: string;
    mime_type: string;
    caption?: string;
  };
};

/**
 * Document message
 */
export type DocumentMessage = WhatsAppMessage & {
  type: "document";
  document: {
    id: string;
    mime_type: string;
    filename?: string;
    caption?: string;
  };
};

/**
 * Union type for all message types
 */
export type IncomingMessage = 
  | TextMessage 
  | InteractiveMessage 
  | LocationMessage 
  | ImageMessage 
  | DocumentMessage;

// ============================================================================
// WEBHOOK PAYLOAD
// ============================================================================

/**
 * WhatsApp webhook payload
 */
export type WebhookPayload = {
  object: string;
  entry: WebhookEntry[];
};

/**
 * Webhook entry
 */
export type WebhookEntry = {
  id: string;
  changes: WebhookChange[];
};

/**
 * Webhook change
 */
export type WebhookChange = {
  field: string;
  value: {
    messaging_product: string;
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: WebhookContact[];
    messages?: RawMessage[];
    statuses?: unknown[];
  };
};

/**
 * Webhook contact
 */
export type WebhookContact = {
  wa_id: string;
  profile?: {
    name?: string;
  };
};

/**
 * Raw message from webhook
 */
export type RawMessage = Record<string, unknown> & {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
};

// ============================================================================
// OUTGOING MESSAGES
// ============================================================================

/**
 * Button specification
 */
export type ButtonSpec = {
  id: string;
  title: string;
};

/**
 * List row specification
 */
export type ListRowSpec = {
  id: string;
  title: string;
  description?: string;
};

/**
 * List message options
 */
export type ListMessageOptions = {
  title: string;
  body: string;
  buttonText: string;
  sectionTitle?: string;
  rows: ListRowSpec[];
};

/**
 * Location to send
 */
export type OutgoingLocation = {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

/**
 * Template message options
 */
export type TemplateOptions = {
  name: string;
  language: string;
  bodyParameters?: Array<{ type: "text"; text: string }>;
};
