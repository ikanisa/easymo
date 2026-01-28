import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface ListingFilter {
    category?: string;
    location?: string;
    priceMin?: number;
    priceMax?: number;
}

export interface ProductListing {
    id: string;
    session_id: string;
    listing_type: 'product' | 'service';
    category: string;
    title: string;
    description: string | null;
    price: number | null;
    currency: string;
    price_type: 'fixed' | 'negotiable' | 'range';
    price_min: number | null;
    price_max: number | null;
    location_text: string | null;
    geo: string | null;
    media_urls: string[];
    availability: 'unknown' | 'in_stock' | 'made_to_order' | 'service_available';
    status: 'draft' | 'published' | 'hidden' | 'deleted';
    is_verified_seller: boolean;
    published_at: string | null;
    created_at: string;
}

export const useListings = (filters: ListingFilter = {}) => {
    const [listings, setListings] = useState<ProductListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchListings();
    }, [JSON.stringify(filters)]);

    const fetchListings = async () => {
        try {
            setLoading(true);

            let query = supabase
                .from('product_listings')
                .select('*')
                .eq('status', 'published')
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.category && filters.category !== 'all') {
                query = query.eq('category', filters.category);
            }

            if (filters.location) {
                query = query.ilike('location_text', `%${filters.location}%`);
            }

            if (filters.priceMin) {
                query = query.gte('price', filters.priceMin);
            }

            if (filters.priceMax) {
                query = query.lte('price', filters.priceMax);
            }

            const { data, error } = await query;

            if (error) throw error;

            setListings(data as ProductListing[]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const createListing = async (listingData: Partial<ProductListing>) => {
        const { data, error } = await supabase
            .from('product_listings')
            .insert({
                ...listingData,
                status: 'published',
                published_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Refresh listings
        fetchListings();

        return data;
    };

    return {
        listings,
        loading,
        error,
        createListing,
        refresh: fetchListings
    };
};
