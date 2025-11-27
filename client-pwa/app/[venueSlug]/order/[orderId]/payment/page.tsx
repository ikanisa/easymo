import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PaymentPage } from './PaymentPage';
import { getVenueBySlug } from '@/lib/api/menu';
import { getOrder } from '@/lib/api/orders';

interface PageProps {
  params: { venueSlug: string; orderId: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const venue = await getVenueBySlug(params.venueSlug);
  
  if (!venue) {
    return { title: 'Payment' };
  }

  return {
    title: `Payment - ${venue.name}`,
    description: `Complete payment for your order at ${venue.name}`,
  };
}

export default async function Page({ params }: PageProps) {
  const [venue, order] = await Promise.all([
    getVenueBySlug(params.venueSlug),
    getOrder(params.orderId),
  ]);
  
  if (!venue || !order) {
    notFound();
  }

  return <PaymentPage venue={venue} order={order} />;
}
