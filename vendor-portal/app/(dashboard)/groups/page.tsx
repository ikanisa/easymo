import { StatsCard } from '@/components/dashboard/StatsCard';

export default function GroupsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ikimina (Groups)</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage savings groups and their members
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Groups"
          value="0"
          description="Active savings groups"
        />
        <StatsCard
          title="Total Members"
          value="0"
          description="Members across all groups"
        />
        <StatsCard
          title="Total Savings"
          value="RWF 0"
          description="Cumulative group savings"
        />
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500 text-center py-12">
          Ikimina groups will be displayed here
        </p>
      </div>
    </div>
  );
}
