import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

import { PropertyClient } from './PropertyClient';

export const dynamic = 'force-dynamic';

export default async function PropertyListingsDashboard() {
  const supabase = getSupabaseAdminClient();
  
  if (!supabase) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600">Configuration Error</h2>
        <p className="mt-2 text-gray-600">Supabase client could not be initialized. Please check server logs.</p>
      </div>
    );
  }

  const [totalResult, activeResult, rentedResult, soldResult] = await Promise.all([
    supabase.from('property_listings').select('*', { count: 'exact', head: true }),
    supabase.from('property_listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('property_listings').select('*', { count: 'exact', head: true }).eq('status', 'rented'),
    supabase.from('property_listings').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
  ]);

  const { data: priceData } = await supabase
    .from('property_listings')
    .select('price')
    .eq('status', 'active');

  const avgPrice = priceData && priceData.length > 0
    ? priceData.reduce((sum, item) => sum + Number(item.price), 0) / priceData.length
    : 0;

  const stats = {
    total_listings: totalResult.count || 0,
    active_listings: activeResult.count || 0,
    rented_listings: rentedResult.count || 0,
    sold_listings: soldResult.count || 0,
    avg_price: avgPrice,
  };

  const { data: listings } = await supabase
    .from('property_listings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  return <PropertyClient initialStats={stats} initialListings={listings || []} />;
}
