import { StatsCard } from '@/components/dashboard/StatsCard';

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="mt-1 text-sm text-gray-600">
          Track and reconcile member payments
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Payments"
          value="RWF 0"
          description="All-time payment volume"
        />
        <StatsCard
          title="This Month"
          value="RWF 0"
          description="Payments received this month"
        />
        <StatsCard
          title="Pending"
          value="0"
          description="Payments awaiting reconciliation"
        />
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500 text-center py-12">
          Payment transactions will be displayed here
        </p>
      </div>
    </div>
  );
}
