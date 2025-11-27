import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { VenuePage } from './VenuePage';
import { getVenueBySlug, getMenuCategories, getMenuItems } from '@/lib/api/menu';

interface PageProps {
  params: { venueSlug: string };
  searchParams: { table?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const venue = await getVenueBySlug(params.venueSlug);
  
  if (!venue) {
    return { title: 'Venue Not Found' };
  }

  return {
    title: `${venue.name} - Menu`,
    description: venue.description || `Order food and drinks at ${venue.name}`,
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const venue = await getVenueBySlug(params.venueSlug);
  
  if (!venue) {
    notFound();
  }

  const [categories, menuItems] = await Promise.all([
    getMenuCategories(venue.id),
    getMenuItems(venue.id),
  ]);

  return (
    <VenuePage
      venue={venue}
      categories={categories}
      menuItems={menuItems}
      tableNumber={searchParams.table}
    />
  );
}
