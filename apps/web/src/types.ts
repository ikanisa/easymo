export interface Listing {
    id: string;
    title: string;
    price: number;
    currency: string;
    image: string;
    category: string;
    location: string;
    verified: boolean;
    postedAt: string;
}

export interface Vendor {
    id: string;
    name: string;
    avatar: string; // Emoji or URL
    category: string;
    rating: number;
    reviewCount: number;
    verified: boolean;
    location: string;
    productsCount: number;
    responseTime: string; // e.g. "< 10m"
}
