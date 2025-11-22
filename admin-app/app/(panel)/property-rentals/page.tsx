'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';

interface PropertyListing {
  id: string;
  title: string;
  description: string;
  type: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  price: number;
  currency: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  amenities: string[];
  images: string[];
  status: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface PropertyStats {
  total_listings: number;
  active_listings: number;
  rented_listings: number;
  sold_listings: number;
  avg_price: number;
}

export default function PropertyListingsDashboard() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [stats, setStats] = useState<PropertyStats | null>(null);
  const [recentListings, setRecentListings] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'for-sale' | 'for-rent' | 'analytics'>('overview');

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Load stats
        const [totalResult, activeResult, rentedResult, soldResult] = await Promise.all([
          supabase.from('property_listings').select('*', { count: 'exact', head: true }),
          supabase.from('property_listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('property_listings').select('*', { count: 'exact', head: true }).eq('status', 'rented'),
          supabase.from('property_listings').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
        ]);

        // Calculate average price
        const { data: priceData } = await supabase
          .from('property_listings')
          .select('price')
          .eq('status', 'active');

        const avgPrice = priceData && priceData.length > 0
          ? priceData.reduce((sum, item) => sum + Number(item.price), 0) / priceData.length
          : 0;

        setStats({
          total_listings: totalResult.count || 0,
          active_listings: activeResult.count || 0,
          rented_listings: rentedResult.count || 0,
          sold_listings: soldResult.count || 0,
          avg_price: avgPrice,
        });

        // Load recent listings
        const { data: listings } = await supabase
          .from('property_listings')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        setRecentListings(listings || []);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading property listings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Property Rentals Dashboard</h1>
        <p className="text-gray-600 mt-2">WhatsApp AI-powered real estate marketplace</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Listings"
          value={stats?.total_listings || 0}
          subtitle={`${stats?.active_listings || 0} active`}
          icon="🏠"
          color="blue"
        />
        <StatCard
          title="For Rent"
          value={stats?.rented_listings || 0}
          subtitle="Currently rented"
          icon="🔑"
          color="green"
        />
        <StatCard
          title="Sold"
          value={stats?.sold_listings || 0}
          subtitle="Completed sales"
          icon="✅"
          color="purple"
        />
        <StatCard
          title="Avg Price"
          value={`${Math.round(stats?.avg_price || 0).toLocaleString()} RWF`}
          subtitle="Active listings"
          icon="💰"
          color="orange"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {(['overview', 'for-sale', 'for-rent', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Listings</h2>
            <div className="space-y-4">
              {recentListings.length === 0 ? (
                <p className="text-gray-500">No property listings yet</p>
              ) : (
                recentListings.map((listing) => (
                  <div key={listing.id} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{listing.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {listing.description.substring(0, 100)}
                          {listing.description.length > 100 ? '...' : ''}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>📍 {typeof listing.location === 'object' ? listing.location.address : listing.location}</span>
                          <span>🏷️ {listing.property_type}</span>
                          {listing.bedrooms && <span>🛏️ {listing.bedrooms} beds</span>}
                          {listing.bathrooms && <span>🚿 {listing.bathrooms} baths</span>}
                          <span>💰 {Number(listing.price).toLocaleString()} {listing.currency}</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            listing.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : listing.status === 'rented'
                              ? 'bg-blue-100 text-blue-800'
                              : listing.status === 'sold'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {listing.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      Listed {new Date(listing.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Location Distribution</h2>
              <p className="text-gray-500 text-sm">Coming soon: Property location analytics</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Price Trends</h2>
              <p className="text-gray-500 text-sm">Coming soon: Market price analysis</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'for-sale' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Properties for Sale</h2>
          <p className="text-gray-500">Full sale listings management coming soon</p>
        </div>
      )}

      {activeTab === 'for-rent' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Rental Properties</h2>
          <p className="text-gray-500">Rental listings management coming soon</p>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Market Analytics</h2>
          <p className="text-gray-500">Advanced analytics coming soon</p>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`text-4xl ${colorClasses[color]} rounded-full w-16 h-16 flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
