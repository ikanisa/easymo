import { notFound } from "next/navigation";
import { getMemberGroupSummary } from "@/lib/member/data";
import { GroupDetailClient } from "@/components/member/groups/group-detail-client";

interface GroupDetailPageProps {
  params: { id: string };
}

/**
 * Group Detail Page
 *
 * Server component that fetches group and SACCO data, then renders
 * the client component with interactive features.
 *
 * @accessibility
 * - Uses semantic HTML structure
 * - Delegates interactive elements to client component
 */
export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id } = params;
  const { group, sacco } = await getMemberGroupSummary(id);

  if (!group) {
    notFound();
  }

  return <GroupDetailClient group={group} sacco={sacco} />;
}
