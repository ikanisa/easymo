import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, meta, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__summary">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {meta ? <div className="page-header__meta">{meta}</div> : null}
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
