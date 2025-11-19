import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ShellHeader({ title, subtitle, icon, actions, className }: HeaderProps) {
  return (
    <header
      className={clsx(
        "flex h-[length:var(--ui-shell-header-height,3.5rem)] items-center justify-between gap-4",
        "rounded-2xl bg-[color:var(--ui-color-surface)]/75 px-4 py-3 shadow-[var(--ui-elevation-low,0_1px_2px_rgba(7,11,26,0.2))]",
        "backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon ? <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--ui-color-surface-muted)]/80 text-[color:var(--ui-color-accent)]">{icon}</span> : null}
        <div className="space-y-0.5">
          {title ? (
            <h1 className="text-base font-semibold leading-tight text-[color:var(--ui-color-foreground)]">
              {title}
            </h1>
          ) : null}
          {subtitle ? <p className="text-sm text-[color:var(--ui-color-muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface SidebarNavItem {
  label: string;
  href?: string;
  icon?: ReactNode;
  active?: boolean;
  action?: ReactNode;
}

export interface SidebarSectionProps {
  title?: string;
  items: SidebarNavItem[];
  onNavigate?: (item: SidebarNavItem) => void;
}

export function SidebarSection({ title, items, onNavigate }: SidebarSectionProps) {
  return (
    <div className="space-y-2">
      {title ? <p className="px-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-color-muted)]">{title}</p> : null}
      <nav aria-label={title} className="space-y-1">
        {items.map((item) => {
          const content = (
            <span className="inline-flex w-full items-center justify-between gap-2">
              <span className="inline-flex items-center gap-3">
                {item.icon ? <span className="text-[color:var(--ui-color-muted)]">{item.icon}</span> : null}
                <span>{item.label}</span>
              </span>
              {item.action}
            </span>
          );

          return item.href ? (
            <a
              key={item.href ?? item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              onClick={(event) => {
                if (onNavigate) {
                  event.preventDefault();
                  onNavigate(item);
                }
              }}
              className={clsx(
                "block rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                "text-[color:var(--ui-color-foreground)] hover:bg-[color:var(--ui-color-surface-muted)]/90",
                item.active &&
                  "bg-[color:var(--ui-color-accent)]/15 text-[color:var(--ui-color-accent-foreground,var(--ui-color-accent))]",
              )}
            >
              {content}
            </a>
          ) : (
            <button
              key={item.href ?? item.label}
              type="button"
              aria-current={item.active ? "page" : undefined}
              onClick={() => onNavigate?.(item)}
              className={clsx(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                "text-[color:var(--ui-color-foreground)] hover:bg-[color:var(--ui-color-surface-muted)]/90",
                item.active &&
                  "bg-[color:var(--ui-color-accent)]/15 text-[color:var(--ui-color-accent-foreground,var(--ui-color-accent))]",
              )}
            >
              {content}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export interface SidebarProps {
  header?: ReactNode;
  sections: SidebarSectionProps[];
  footer?: ReactNode;
  className?: string;
}

export function Sidebar({ header, sections, footer, className }: SidebarProps) {
  return (
    <aside
      className={clsx(
        "hidden w-[length:var(--ui-shell-sidebar-width,18rem)] shrink-0 lg:block",
        "rounded-2xl border border-[color:var(--ui-color-border)]/70 bg-[color:var(--ui-color-surface)]/75",
        "p-4 shadow-[var(--ui-elevation-low,0_1px_2px_rgba(7,11,26,0.2))] backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex h-full flex-col gap-4">
        {header}
        <div className="space-y-4">
          {sections.map((section) => (
            <SidebarSection key={section.title ?? section.items[0]?.label} {...section} />
          ))}
        </div>
        {footer ? <div className="mt-auto pt-2">{footer}</div> : null}
      </div>
    </aside>
  );
}

export interface AppShellProps {
  header?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}

export function AppShell({ header, sidebar, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--ui-color-background)] text-[color:var(--ui-color-foreground)]">
      <div className="mx-auto flex w-full max-w-[length:var(--ui-shell-max-width,1200px)] flex-col gap-6 px-[length:var(--ui-shell-gutter,1.5rem)] py-6 lg:flex-row">
        <div className="flex w-full flex-col gap-4">
          {header}
          <main className="flex-1 space-y-4">{children}</main>
        </div>
        {sidebar}
      </div>
    </div>
  );
}
