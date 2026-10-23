import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Maximize2, Minus, Square, X } from 'lucide-react';
import type { DesktopWindow, WindowBounds } from './types';

interface Props {
  window: DesktopWindow;
  active: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onMove: (bounds: WindowBounds) => void;
  onResize: (bounds: WindowBounds) => void;
  children: ReactNode;
}

type DragState = { pointerX: number; pointerY: number; bounds: WindowBounds; mode: 'move' | 'resize' };

export function WindowFrame({ window: win, active, zIndex, onFocus, onClose, onMinimize, onToggleMaximize, onMove, onResize, children }: Props) {
  const drag = useRef<DragState | null>(null);
  const [previewBounds, setPreviewBounds] = useState<WindowBounds | null>(null);
  const bounds = previewBounds ?? win.bounds;

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!drag.current) return;
      const current = drag.current;
      const dx = event.clientX - current.pointerX;
      const dy = event.clientY - current.pointerY;
      const next = current.mode === 'move'
        ? { ...current.bounds, x: current.bounds.x + dx, y: current.bounds.y + dy }
        : { ...current.bounds, width: Math.max(320, current.bounds.width + dx), height: Math.max(220, current.bounds.height + dy) };
      setPreviewBounds(next);
    };
    const handleUp = () => {
      if (!drag.current) return;
      const finalBounds = previewBounds;
      if (finalBounds) (drag.current.mode === 'move' ? onMove : onResize)(finalBounds);
      drag.current = null;
      setPreviewBounds(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [onMove, onResize, previewBounds]);

  const beginDrag = (event: ReactPointerEvent, mode: 'move' | 'resize') => {
    if ((event.target as HTMLElement).closest('button')) return;
    if (win.status === 'maximized') return;
    event.preventDefault();
    onFocus();
    drag.current = { pointerX: event.clientX, pointerY: event.clientY, bounds: win.bounds, mode };
  };

  if (win.status === 'minimized') return null;
  const isMaximized = win.status === 'maximized';

  return (
    <section
      className={`window-frame ${active ? 'is-active' : ''} ${isMaximized ? 'is-maximized' : ''}`}
      style={isMaximized ? { zIndex, inset: '16px 16px 82px', width: 'auto', height: 'auto' } : { zIndex, left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }}
      onPointerDown={onFocus}
      aria-label={`${win.title} window`}
    >
      <header className="window-titlebar" onPointerDown={(event) => beginDrag(event, 'move')} onDoubleClick={onToggleMaximize}>
        <div className="window-controls" aria-label="Window controls">
          <button className="window-control close" onClick={onClose} aria-label={`Close ${win.title}`}><X size={12} /></button>
          <button className="window-control minimize" onClick={onMinimize} aria-label={`Minimize ${win.title}`}><Minus size={12} /></button>
          <button className="window-control maximize" onClick={onToggleMaximize} aria-label={`Maximize ${win.title}`}><Square size={10} /></button>
        </div>
        <span className="window-title">{win.title}</span>
        <button className="titlebar-action" onClick={onToggleMaximize} aria-label="Toggle maximize"><Maximize2 size={13} /></button>
      </header>
      <div className="window-content">{children}</div>
      {!isMaximized && <div className="resize-handle" onPointerDown={(event) => beginDrag(event, 'resize')} aria-label={`Resize ${win.title}`} />}
    </section>
  );
}
