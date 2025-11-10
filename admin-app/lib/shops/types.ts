export interface ShopLocation {
  lat: number;
  lng: number;
}

export interface Shop {
  id: string;
  name: string;
  description: string;
  categories: string[];
  whatsappCatalogUrl: string | null;
  phone: string | null;
  openingHours: string | null;
  verified: boolean;
  status: string;
  rating: number | null;
  totalReviews: number;
  location: ShopLocation | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShopPayload {
  name: string;
  description?: string;
  phone?: string;
  categories: string[];
  location?: ShopLocation;
  whatsappCatalogUrl?: string;
  openingHours?: string;
}
