import { StatsCard } from '@/components/dashboard/StatsCard';

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage SACCO members and their accounts
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Members"
          value="0"
          description="Active SACCO members"
        />
        <StatsCard
          title="New This Month"
          value="0"
          description="Members joined this month"
        />
        <StatsCard
          title="Active Accounts"
          value="0"
          description="Members with active accounts"
        />
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500 text-center py-12">
          Member list will be displayed here
        </p>
      </div>
    </div>
  );
}
