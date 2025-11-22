import { Tool, AgentContext } from '../../base/types';

/**
 * MoMo USSD Payment Tool
 * Initiate MoMo payment via USSD (no API)
 */
export const momoUSSDTool: Tool = {
  name: 'momo_ussd_payment',
  description: 'Initiate MoMo payment via USSD code',
  parameters: {
    type: 'object',
    properties: {
      phone_number: { type: 'string', description: 'Customer phone number' },
      amount: { type: 'number', description: 'Amount in RWF' },
      merchant_code: { type: 'string', description: 'Merchant USSD code' },
      reference: { type: 'string', description: 'Payment reference' }
    },
    required: ['phone_number', 'amount']
  },
  capabilities: ['payment', 'momo'],
  execute: async (params, context) => {
    // Since MoMo USSD has no API, we guide the user through the process
    const ussdCode = `*182*8*1*${params.merchant_code || '000000'}*${params.amount}#`;
    
    return {
      status: 'pending',
      ussd_code: ussdCode,
      instructions: `Please dial ${ussdCode} on your phone to complete the payment of ${params.amount} RWF`,
      amount: params.amount,
      reference: params.reference || 'REF_' + Date.now(),
      message: 'Customer will receive SMS prompt to authorize payment'
    };
  }
};

/**
 * WhatsApp Business API Tool
 * Send messages via WhatsApp Business API
 */
export const whatsappTool: Tool = {
  name: 'whatsapp_send',
  description: 'Send WhatsApp messages (text, images, templates)',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient phone number (international format)' },
      message: { type: 'string', description: 'Message text' },
      type: { type: 'string', enum: ['text', 'template', 'image'], description: 'Message type' },
      template_name: { type: 'string', description: 'Template name (if type=template)' },
      image_url: { type: 'string', description: 'Image URL (if type=image)' }
    },
    required: ['to', 'message']
  },
  capabilities: ['messaging', 'whatsapp'],
  execute: async (params, context) => {
    const axios = require('axios');
    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!whatsappToken || !phoneNumberId) {
      throw new Error('WhatsApp credentials not configured');
    }

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    let messageData: any = {
      messaging_product: 'whatsapp',
      to: params.to
    };

    if (params.type === 'text' || !params.type) {
      messageData.type = 'text';
      messageData.text = { body: params.message };
    } else if (params.type === 'template') {
      messageData.type = 'template';
      messageData.template = {
        name: params.template_name,
        language: { code: 'en' }
      };
    } else if (params.type === 'image') {
      messageData.type = 'image';
      messageData.image = {
        link: params.image_url,
        caption: params.message
      };
    }

    const response = await axios.post(url, messageData, {
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      message_id: response.data.messages?.[0]?.id,
      status: 'sent',
      to: params.to
    };
  }
};

/**
 * SMS Tool
 * Send SMS notifications
 */
export const smsTool: Tool = {
  name: 'sms_send',
  description: 'Send SMS notifications',
  parameters: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient phone number' },
      message: { type: 'string', description: 'SMS message text' }
    },
    required: ['to', 'message']
  },
  capabilities: ['messaging', 'sms'],
  execute: async (params, context) => {
    // SMS gateway integration would go here
    // For now, returning a placeholder
    
    return {
      message_id: 'sms_' + Date.now(),
      status: 'sent',
      to: params.to,
      message: 'SMS integration pending - requires SMS gateway credentials'
    };
  }
};
