export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
}
