export const dynamic = "force-dynamic";

import { SmsVendorDetailClient } from "./SmsVendorDetailClient";

export default async function SmsVendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SmsVendorDetailClient vendorId={id} />;
}
