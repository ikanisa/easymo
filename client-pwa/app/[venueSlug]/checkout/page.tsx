import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CheckoutPage } from './CheckoutPage';
import { getVenueBySlug } from '@/lib/api/menu';

interface PageProps {
  params: { venueSlug: string };
  searchParams: { table?: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const venue = await getVenueBySlug(params.venueSlug);
  
  if (!venue) {
    return { title: 'Checkout' };
  }

  return {
    title: `Checkout - ${venue.name}`,
    description: `Complete your order at ${venue.name}`,
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const venue = await getVenueBySlug(params.venueSlug);
  
  if (!venue) {
    notFound();
  }

  return (
    <CheckoutPage
      venue={venue}
      tableNumber={searchParams.table}
    />
  );
}
