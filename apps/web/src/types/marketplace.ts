import { ReactNode } from 'react';

export interface Category {
    id: string;
    name: string;
    icon: string | ReactNode;
    color: string;
}

export interface Vendor {
    id: number;
    name: string;
    category: string;
    rating: number;
    reviews: number;
    verified: boolean;
    location: string;
    image: string | ReactNode;
    color: string;
    products: number;
    responseTime: string;
}

export interface Listing {
    id: number;
    title: string;
    price: number;
    currency: string;
    category: string;
    location: string;
    verified: boolean;
    vendorName: string;
    image: string | ReactNode;
    condition: string;
    postedTime: string;
    views: number;
    saves: number;
    description?: string;
    reviews?: number;
    rating?: number;
    products?: number; // fallback for when listing acts as vendor detail source
    responseTime?: string; // fallback
    color?: string; // fallback
    name?: string; // fallback
}

export interface Request {
    id: number;
    type: 'buy' | 'service';
    title: string;
    budget: string;
    location: string;
    postedTime: string;
    matches: number;
    status: 'active' | 'closed';
}

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date;
    quickReplies?: string[];
}
