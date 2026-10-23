import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { DesktopWindow, WindowBounds } from './types';

interface Props {
  window:            DesktopWindow;
  active:            boolean;
  zIndex:            number;
  onFocus:           () => void;
  onClose:           () => void;
  onMinimize:        () => void;
  onToggleMaximize:  () => void;
  onMove:            (bounds: WindowBounds) => void;
  onResize:          (bounds: WindowBounds) => void;
  children:          ReactNode;
}

type DragState = { pointerX: number; pointerY: number; bounds: WindowBounds; mode: 'move' | 'resize' };

export function WindowFrame({ window: win, active, zIndex, onFocus, onClose, onMinimize, onToggleMaximize, onMove, onResize, children }: Props) {
  const drag = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<WindowBounds | null>(null);
  const bounds = preview ?? win.bounds;

  useEffect(() => {
    const onMove_ = (e: PointerEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.pointerX;
      const dy = e.clientY - drag.current.pointerY;
      const next = drag.current.mode === 'move'
        ? { ...drag.current.bounds, x: drag.current.bounds.x + dx, y: drag.current.bounds.y + dy }
        : { ...drag.current.bounds, width: Math.max(360, drag.current.bounds.width + dx), height: Math.max(240, drag.current.bounds.height + dy) };
      setPreview(next);
    };
    const onUp = () => {
      if (!drag.current) return;
      const final = preview;
      if (final) (drag.current.mode === 'move' ? onMove : onResize)(final);
      drag.current = null;
      setPreview(null);
    };
    window.addEventListener('pointermove', onMove_);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove_); window.removeEventListener('pointerup', onUp); };
  }, [onMove, onResize, preview]);

  const beginDrag = (e: ReactPointerEvent, mode: 'move' | 'resize') => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (win.status === 'maximized') return;
    e.preventDefault();
    onFocus();
    drag.current = { pointerX: e.clientX, pointerY: e.clientY, bounds: win.bounds, mode };
  };

  if (win.status === 'minimized') return null;
  const isMax = win.status === 'maximized';

  return (
    <section
      className={`wf ${active ? 'wf--active' : ''} ${isMax ? 'wf--max' : ''}`}
      style={isMax
        ? { zIndex, position: 'absolute', inset: 0, width: 'auto', height: 'auto' }
        : { zIndex, left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }}
      onPointerDown={onFocus}
      aria-label={`${win.title} window`}
    >
      {/* Title bar */}
      <header
        className="wf-titlebar"
        onPointerDown={e => beginDrag(e, 'move')}
        onDoubleClick={onToggleMaximize}
      >
        {/* Traffic lights — LEFT side like macOS */}
        <div className="wf-controls" aria-label="Window controls">
          <button className="wf-btn wf-close"    onClick={onClose}          aria-label={`Close ${win.title}`}    title="Close" />
          <button className="wf-btn wf-minimize"  onClick={onMinimize}       aria-label={`Minimize ${win.title}`} title="Minimize" />
          <button className="wf-btn wf-maximize"  onClick={onToggleMaximize} aria-label={`Maximize ${win.title}`} title={isMax ? 'Restore' : 'Maximize'} />
        </div>

        {/* Centered title */}
        <span className="wf-title">{win.title}</span>

        {/* Spacer to balance traffic lights */}
        <div className="wf-controls wf-controls--ghost" aria-hidden />
      </header>

      {/* Content */}
      <div className="wf-content">{children}</div>

      {/* Resize handle */}
      {!isMax && (
        <div
          className="wf-resize"
          onPointerDown={e => beginDrag(e, 'resize')}
          aria-label={`Resize ${win.title}`}
        />
      )}
    </section>
  );
}
