'use client';

import { forwardRef } from 'react';
import * as Icons from 'lucide-react';

export type IconName = keyof typeof Icons;

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  label?: string;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon({ name, label, ...props }, ref) {
  const LucideIcon = Icons[name] ?? Icons.HelpCircle;
  const ariaLabel = label ?? name.replace(/([A-Z])/g, ' $1').trim();

  return <LucideIcon ref={ref} aria-label={ariaLabel} role={label ? 'img' : undefined} {...props} />;
});
