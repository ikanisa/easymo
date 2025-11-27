/**
 * Aurora Layout - Modern FluidShell wrapper for migrated pages
 */
import { FluidShell } from '@/components/aurora-v2/layout';
import { CommandPalette } from '@/components/aurora-v2/command';

export default function AuroraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FluidShell>
      <CommandPalette />
      {children}
    </FluidShell>
  );
}
