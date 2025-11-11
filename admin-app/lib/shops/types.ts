export interface ShopLocation {
  lat: number;
  lng: number;
}

export interface Shop {
  id: string;
  name: string;
  description: string;
  tags: string[];
  whatsappCatalogUrl: string | null;
  phone: string | null;
  openingHours: string | null;
  verified: boolean;
  status: string;
  rating: number | null;
  totalReviews: number;
  businessLocation: string | null;
  coordinates: ShopLocation | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShopPayload {
  name: string;
  description: string;
  phone?: string;
  tags: string[];
  businessLocation: string;
  coordinates?: ShopLocation;
  whatsappCatalogUrl?: string;
  openingHours?: string;
}
