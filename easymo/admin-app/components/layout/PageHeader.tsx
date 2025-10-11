import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description: string;
  meta?: ReactNode;
}

export function PageHeader({ title, description, meta }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__summary">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {meta ? <div className="page-header__meta">{meta}</div> : null}
    </header>
  );
}
