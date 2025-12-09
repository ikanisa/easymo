import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="mb-2 h-8 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Settings Tabs/Sections */}
      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
        {["General", "Security", "Notifications", "Integration", "Advanced"].map((tab) => (
          <Skeleton key={tab} className="h-10 w-28" />
        ))}
      </div>

      {/* Settings Content */}
      <div className="space-y-6">
        {/* Organization Settings */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
          <Skeleton className="mb-4 h-6 w-48" />
          <div className="space-y-4">
            <div>
              <Skeleton className="mb-2 h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="mb-2 h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="mb-2 h-4 w-36" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
          <Skeleton className="mb-4 h-6 w-32" />
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-32 w-32 rounded-lg" />
              <Skeleton className="mt-2 h-9 w-28" />
            </div>
            <div className="space-y-4">
              <div>
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <Skeleton className="mb-2 h-4 w-36" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <Skeleton className="mb-1 h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <Skeleton className="mb-4 h-6 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-4 h-10 w-40" />
          </div>
        </div>
      </div>

      {/* Save Actions */}
      <div className="flex items-center justify-between border-t border-neutral-200 pt-6 dark:border-neutral-700">
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}
