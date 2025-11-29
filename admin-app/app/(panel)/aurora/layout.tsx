/**
 * Aurora Layout - Modern FluidShell wrapper for migrated pages
 */
import { CommandPalette } from '@/components/aurora-v2/command';
import { FluidShell } from '@/components/aurora-v2/layout';

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
