import { AppShellHero } from "@/components/layout/app-shell";
import {
  WorkspaceLayout,
  WorkspaceMain,
  WorkspaceAside,
} from "@/components/layout/workspace-layout";
import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Trans } from "@/components/common/trans";

export default function MomoInboxLoading() {
  return (
    <>
      <AppShellHero>
        <GradientHeader
          title={<Trans k="momoInbox.title" defaultText="Mobile Money SMS Inbox" />}
          description={
            <Trans
              k="momoInbox.description"
              defaultText="Review and manage incoming Mobile Money payment notifications"
            />
          }
        />
      </AppShellHero>

      <WorkspaceLayout>
        <WorkspaceMain>
          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <GlassCard key={i}>
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Table Skeleton */}
          <GlassCard>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </GlassCard>
        </WorkspaceMain>

        <WorkspaceAside>
          <GlassCard>
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </GlassCard>
        </WorkspaceAside>
      </WorkspaceLayout>
    </>
  );
}
