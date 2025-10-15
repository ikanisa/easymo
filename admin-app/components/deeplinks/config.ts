export type AdminDeeplinkFlow = 'insurance_attach' | 'basket_open' | 'generate_qr';

export type FlowFieldType = 'text' | 'number';

export interface FlowField {
  name: string;
  label: string;
  type: FlowFieldType;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
}

export interface FlowDefinition {
  flow: AdminDeeplinkFlow;
  label: string;
  description: string;
  buttonTitle: string;
  previewMessage: string;
  fields: FlowField[];
}

export const FLOW_DEFINITIONS: FlowDefinition[] = [
  {
    flow: 'insurance_attach',
    label: 'Insurance certificate attach',
    description: 'Skips the menu and prompts the user to upload their insurance certificate immediately.',
    buttonTitle: 'Attach Certificate',
    previewMessage: 'Attach your insurance certificate in one step.',
    fields: [
      {
        name: 'request_id',
        label: 'Request ID',
        type: 'text',
        placeholder: 'rq_12345',
        required: true,
      },
      {
        name: 'policy_id',
        label: 'Policy ID (optional)',
        type: 'text',
        placeholder: 'pol_abc123',
      },
      {
        name: 'basket_id',
        label: 'Basket ID (optional)',
        type: 'text',
        placeholder: 'bkt_abcde',
      },
    ],
  },
  {
    flow: 'basket_open',
    label: 'Open a basket',
    description: 'Jump into an existing basket view with suggested next actions.',
    buttonTitle: 'Open Basket',
    previewMessage: 'Open your basket and manage members or contributions.',
    fields: [
      {
        name: 'basket_id',
        label: 'Basket ID',
        type: 'text',
        placeholder: 'bkt_abcde',
        required: true,
      },
      {
        name: 'basket_name',
        label: 'Basket name (optional)',
        type: 'text',
        placeholder: 'Taxi Kimironko',
      },
      {
        name: 'inviter_id',
        label: 'Inviter user ID (optional)',
        type: 'text',
        placeholder: 'usr_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
    ],
  },
  {
    flow: 'generate_qr',
    label: 'Generate MoMo QR',
    description: 'Land directly on the QR generator with optional amount and note prefill.',
    buttonTitle: 'Generate QR',
    previewMessage: 'Generate a MoMo QR code with preset details.',
    fields: [
      {
        name: 'amount',
        label: 'Amount (optional)',
        type: 'number',
        placeholder: '2000',
      },
      {
        name: 'currency',
        label: 'Currency (optional)',
        type: 'text',
        placeholder: 'RWF',
      },
      {
        name: 'note',
        label: 'Note (optional)',
        type: 'text',
        placeholder: 'Moto fare Kimironko → CBD',
      },
      {
        name: 'merchant_code',
        label: 'Merchant code (optional)',
        type: 'text',
        placeholder: 'MOMO123',
      },
    ],
  },
];

export const DEFAULT_TTL_DAYS = 14;
