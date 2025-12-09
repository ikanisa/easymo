import { Children, Fragment, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface WorkspaceLayoutProps extends HTMLAttributes<HTMLDivElement> {}

export function WorkspaceLayout({ className, children, ...props }: WorkspaceLayoutProps) {
  return (
    <div
      className={cn(
        "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] lg:items-start",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface WorkspaceMainProps extends HTMLAttributes<HTMLElement> {}

export function WorkspaceMain({ className, children, ...props }: WorkspaceMainProps) {
  return (
    <section className={cn("space-y-6", className)} {...props}>
      {children}
    </section>
  );
}

interface WorkspaceAsideProps extends HTMLAttributes<HTMLElement> {
  sticky?: boolean;
}

export function WorkspaceAside({
  className,
  children,
  sticky = true,
  ...props
}: WorkspaceAsideProps) {
  const content = Children.toArray(children).filter(
    (child) => child !== null && child !== undefined && child !== false
  );

  if (content.length === 0) {
    return null;
  }

  return (
    <aside
      className={cn(
        "space-y-6 lg:min-h-[calc(100vh-9rem)]",
        sticky && "lg:sticky lg:top-24",
        className
      )}
      {...props}
    >
      {content.length === 1 ? content[0] : <Fragment>{content}</Fragment>}
    </aside>
  );
}

export function WorkspaceSection({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-neutral-6/60 bg-white/60 p-4 shadow-sm", className)}
      {...props}
    />
  );
}
