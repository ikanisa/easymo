import { Link } from "react-router-dom";

import "@station/styles/action-card.css";

type ActionCardProps = {
  to: string;
  title: string;
  description: string;
  icon?: string;
};

export const ActionCard = ({ to, title, description, icon }: ActionCardProps) => (
  <Link className="action-card" to={to} aria-label={title} role="button">
    <span className="action-card__icon" aria-hidden="true">
      {icon ?? "➜"}
    </span>
    <span className="action-card__body">
      <span className="action-card__title">{title}</span>
      <span className="action-card__description">{description}</span>
    </span>
  </Link>
);
