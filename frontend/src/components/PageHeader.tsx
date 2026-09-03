import type { ReactNode } from 'react';
import Button from './ui/Button';
import './page-header.css';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActions?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActions,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {actionLabel || secondaryActions ? (
        <div className="page-header__actions">
          {secondaryActions}
          {actionLabel ? (
            <Button variant="primary" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
