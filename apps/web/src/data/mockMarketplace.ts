import { Category, Vendor, Listing, Request, Message } from '../types/marketplace';

export const categories: Category[] = [
    { id: 'all', name: 'All', icon: '🏪', color: '#FF6B6B' },
    { id: 'electronics', name: 'Electronics', icon: '📱', color: '#4ECDC4' },
    { id: 'fashion', name: 'Fashion', icon: '👕', color: '#FFE66D' },
    { id: 'food', name: 'Food', icon: '🍔', color: '#FF8B94' },
    { id: 'services', name: 'Services', icon: '🔧', color: '#A8E6CF' },
    { id: 'home', name: 'Home', icon: '🏠', color: '#C7CEEA' }
];

export const verifiedVendors: Vendor[] = [
    {
        id: 1,
        name: 'TechHub Rwanda',
        category: 'Electronics',
        rating: 4.8,
        reviews: 245,
        verified: true,
        location: 'Kigali, Rwanda',
        image: '📱',
        color: '#4ECDC4',
        products: 156,
        responseTime: '< 1 hour'
    },
    {
        id: 2,
        name: 'Fresh Harvest',
        category: 'Food',
        rating: 4.9,
        reviews: 389,
        verified: true,
        location: 'Musanze, Rwanda',
        image: '🥬',
        color: '#A8E6CF',
        products: 89,
        responseTime: '< 30 min'
    },
    {
        id: 3,
        name: 'Style Avenue',
        category: 'Fashion',
        rating: 4.7,
        reviews: 567,
        verified: true,
        location: 'Kigali, Rwanda',
        image: '👗',
        color: '#FFE66D',
        products: 234,
        responseTime: '< 2 hours'
    }
];

export const listings: Listing[] = [
    {
        id: 1,
        title: 'iPhone 13 Pro Max - Like New',
        price: 850000,
        currency: 'RWF',
        category: 'Electronics',
        location: 'Kigali, Nyarugenge',
        verified: true,
        vendorName: 'TechHub Rwanda',
        image: '📱',
        condition: 'Like New',
        postedTime: '2 hours ago',
        views: 45,
        saves: 12
    },
    {
        id: 2,
        title: 'Professional Photography Services',
        price: 50000,
        currency: 'RWF',
        category: 'Services',
        location: 'Kigali, Gasabo',
        verified: false,
        vendorName: 'Unverified Seller',
        image: '📸',
        condition: 'Service',
        postedTime: '5 hours ago',
        views: 23,
        saves: 7
    },
    {
        id: 3,
        title: 'Organic Fresh Vegetables Box',
        price: 15000,
        currency: 'RWF',
        category: 'Food',
        location: 'Musanze',
        verified: true,
        vendorName: 'Fresh Harvest',
        image: '🥬',
        condition: 'Fresh',
        postedTime: '1 hour ago',
        views: 67,
        saves: 23
    },
    {
        id: 4,
        title: 'Designer Ankara Dress',
        price: 35000,
        currency: 'RWF',
        category: 'Fashion',
        location: 'Kigali, Kicukiro',
        verified: true,
        vendorName: 'Style Avenue',
        image: '👗',
        condition: 'New',
        postedTime: '3 hours ago',
        views: 89,
        saves: 34
    }
];

export const requests: Request[] = [
    {
        id: 1,
        type: 'buy',
        title: 'Looking for MacBook Pro M2',
        budget: '1,200,000 - 1,500,000 RWF',
        location: 'Kigali',
        postedTime: '4 hours ago',
        matches: 7,
        status: 'active'
    },
    {
        id: 2,
        type: 'service',
        title: 'Need Interior Designer',
        budget: 'Negotiable',
        location: 'Kigali, Remera',
        postedTime: '1 day ago',
        matches: 12,
        status: 'active'
    }
];

export const moltbotGreeting: Message = {
    role: 'assistant',
    content: "👋 Hi there! I'm Moltbot, your marketplace assistant. I can help you:\n\n• Buy or sell products\n• Find the best matches\n• Connect with verified vendors\n\nWhat would you like to do today?",
    quickReplies: ['I want to buy something', 'I want to sell something', 'Browse vendors', 'Check my requests']
};
