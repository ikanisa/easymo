/**
 * SMS Provider Integration for MTN Rwanda
 * Handles SMS sending via MTN SMS API
 */

export interface SMSConfig {
  apiKey: string;
  apiSecret: string;
  senderId: string;
  apiUrl?: string;
}

export interface SMSMessage {
  to: string; // Phone number in E.164 format (+250788123456)
  message: string;
  reference?: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
}

/**
 * Send SMS via MTN Rwanda API
 */
export async function sendSMS(
  config: SMSConfig,
  message: SMSMessage
): Promise<SMSResult> {
  try {
    // MTN Rwanda SMS API endpoint
    const apiUrl = config.apiUrl || "https://api.mtn.rw/v1/sms/send";

    // Validate phone number format
    if (!message.to.match(/^\+250[0-9]{9}$/)) {
      return {
        success: false,
        error: "Invalid phone number format. Expected: +250XXXXXXXXX",
      };
    }

    // Prepare request payload
    const payload = {
      sender: config.senderId,
      recipient: message.to,
      message: message.message,
      reference: message.reference || crypto.randomUUID(),
    };

    // Send request to MTN API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
        "X-API-Secret": config.apiSecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MTN SMS API error:", {
        status: response.status,
        error: errorText,
      });

      return {
        success: false,
        error: `MTN API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();

    return {
      success: true,
      messageId: result.message_id || result.id,
      cost: result.cost,
    };
  } catch (error) {
    console.error("SMS send exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send SMS with retry logic
 */
export async function sendSMSWithRetry(
  config: SMSConfig,
  message: SMSMessage,
  maxRetries: number = 3
): Promise<SMSResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await sendSMS(config, message);

    if (result.success) {
      return result;
    }

    lastError = result.error;

    // Don't retry on validation errors
    if (result.error?.includes("Invalid phone number")) {
      return result;
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: `Failed after ${maxRetries} attempts. Last error: ${lastError}`,
  };
}

/**
 * Format message for SMS (160 character limit awareness)
 */
export function formatSMSMessage(
  message: string,
  maxLength: number = 160
): string[] {
  if (message.length <= maxLength) {
    return [message];
  }

  // Split into multiple messages
  const messages: string[] = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      messages.push(remaining);
      break;
    }

    // Try to split at word boundary
    let splitIndex = maxLength;
    const lastSpace = remaining.lastIndexOf(" ", maxLength);

    if (lastSpace > maxLength * 0.7) {
      // If we can split at a word boundary without losing too much space
      splitIndex = lastSpace;
    }

    messages.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return messages;
}

/**
 * Validate Rwanda phone number
 */
export function validateRwandaPhone(phone: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Check if it starts with country code
  if (digits.startsWith("250")) {
    if (digits.length === 12) {
      const normalized = `+${digits}`;
      return { valid: true, normalized };
    }
    return { valid: false, error: "Invalid length with country code" };
  }

  // Check if it's a local number
  if (digits.length === 9 && /^(78|79|73|72)/.test(digits)) {
    const normalized = `+250${digits}`;
    return { valid: true, normalized };
  }

  if (digits.length === 10 && /^0(78|79|73|72)/.test(digits)) {
    const normalized = `+250${digits.slice(1)}`;
    return { valid: true, normalized };
  }

  return {
    valid: false,
    error: "Invalid Rwanda phone number. Expected: 078XXXXXXX, 079XXXXXXX, 073XXXXXXX, or 072XXXXXXX",
  };
}
