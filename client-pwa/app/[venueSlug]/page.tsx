import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { VenueHeader } from '@/components/venue/VenueHeader';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuContent } from '@/components/menu/MenuContent';
import { CartFab } from '@/components/layout/CartFab';
import { VoiceOrder } from '@/components/order/VoiceOrder';
import { BottomNav } from '@/components/layout/BottomNav';
import { MenuSkeleton } from '@/components/menu/MenuSkeleton';

interface VenuePageProps {
  params: { venueSlug: string };
  searchParams: { table?: string; category?: string };
}

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const supabase = createClient();
  const { data: venue } = await supabase
    .from('venues')
    .select('name, description, logo_url')
    .eq('slug', params.venueSlug)
    .single();

  if (!venue) return { title: 'Not Found' };

  return {
    title: `${venue.name} - Menu`,
    description: venue.description || `Order food and drinks at ${venue.name}`,
    openGraph: {
      title: venue.name,
      description: venue.description || `Order food and drinks at ${venue.name}`,
      images: venue.logo_url ? [venue.logo_url] : [],
    },
  };
}

async function getVenueData(slug: string) {
  const supabase = createClient();
  
  const { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!venue) return { venue: null, categories: null };

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('venue_id', venue.id)
    .eq('is_active', true)
    .order('sort_order');

  return { venue, categories };
}

export default async function VenuePage({ params, searchParams }: VenuePageProps) {
  const { venue, categories } = await getVenueData(params.venueSlug);

  if (!venue) {
    notFound();
  }

  const activeCategory = searchParams.category || categories?.[0]?.slug || 'all';

  return (
    <div className="min-h-screen bg-background pb-20">
      <VenueHeader 
        venue={venue} 
        tableNumber={searchParams.table}
      />

      {categories && categories.length > 0 && (
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          venueSlug={params.venueSlug}
        />
      )}

      <Suspense fallback={<MenuSkeleton />}>
        <MenuContent
          venueId={venue.id}
          venueSlug={params.venueSlug}
          categorySlug={activeCategory}
        />
      </Suspense>

      <CartFab venueSlug={params.venueSlug} />
      <VoiceOrder venueId={venue.id} />
      <BottomNav venueSlug={params.venueSlug} />
    </div>
  );
}
