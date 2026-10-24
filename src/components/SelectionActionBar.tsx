import { useEffect, useRef, type ReactNode } from 'react';

export interface SelectionActionItem {
  id: string;
  label: string;
  icon: ReactNode;
  primary?: boolean;
  title?: string;
  onSelect: () => void;
}

export interface SelectionActionBarProps {
  x: number;
  y: number;
  placement?: 'above' | 'below';
  ariaLabel?: string;
  actions: SelectionActionItem[];
  onDismiss: () => void;
}

export function SelectionActionBar({
  x,
  y,
  placement = 'above',
  ariaLabel = 'Context actions for selected text',
  actions,
  onDismiss,
}: SelectionActionBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  if (actions.length === 0) return null;

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={ariaLabel}
      data-placement={placement}
      className={`sel-action-bar is-${placement}`}
      style={{ left: x, top: y }}
      onMouseDown={(e) => {
        /* Prevent textarea blur or DOM selection collapse before button onClick fires */
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action, index) => (
        <span key={action.id} className="sel-action-slot">
          {index > 0 && <span className="sel-action-sep" aria-hidden="true" />}
          <button
            type="button"
            className={`sel-action-btn${action.primary ? ' is-primary' : ''}`}
            title={action.title ?? action.label}
            onClick={(e) => {
              e.stopPropagation();
              action.onSelect();
            }}
          >
            <span className="sel-action-icon" aria-hidden="true">
              {action.icon}
            </span>
            <span>{action.label}</span>
          </button>
        </span>
      ))}
    </div>
  );
}
