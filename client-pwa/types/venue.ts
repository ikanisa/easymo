export interface Venue {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  cover_image_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency: string;
  timezone: string;
  is_active: boolean;
  payment_methods: PaymentMethod[];
  operating_hours?: OperatingHours;
}

export interface PaymentMethod {
  type: 'momo' | 'revolut' | 'cash';
  enabled: boolean;
  config?: Record<string, any>;
}

export interface OperatingHours {
  [key: string]: {
    open: string;
    close: string;
    is_closed: boolean;
  };
}
