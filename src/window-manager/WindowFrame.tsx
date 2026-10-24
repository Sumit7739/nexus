import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Maximize2, Minimize2, PanelLeft, PanelRight } from 'lucide-react';
import type { DesktopWindow, SnapZone, WindowBounds, WindowSnapSide } from './types';
import { clampBounds, detectSnapZone } from './window-store';

interface Props {
  window:              DesktopWindow;
  active:              boolean;
  zIndex:              number;
  onFocus:             () => void;
  onClose:             () => void;
  onMinimize:          () => void;
  onToggleMaximize:    () => void;
  onSnap:              (zone: SnapZone) => void;
  onMove:              (bounds: WindowBounds) => void;
  onResize:            (bounds: WindowBounds) => void;
  onSnapPreviewChange: (zone: SnapZone | null) => void;
  children:            ReactNode;
}

type DragState = {
  pointerX: number;
  pointerY: number;
  bounds: WindowBounds;
  mode: 'move' | 'resize';
  unsnappedDuringDrag: boolean;
  startStatus: DesktopWindow['status'];
  startSnapZone?: WindowSnapSide;
  restoreBounds?: WindowBounds;
};

const DRAG_DETACH_THRESHOLD_PX = 6;

export function WindowFrame({
  window: win,
  active,
  zIndex,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onSnap,
  onMove,
  onResize,
  onSnapPreviewChange,
  children,
}: Props) {
  const drag = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<WindowBounds | null>(null);
  const [detachedFromMax, setDetachedFromMax] = useState(false);
  const bounds = preview ?? win.bounds;

  const previewRef = useRef<WindowBounds | null>(null);
  const activeSnapZoneRef = useRef<SnapZone | null>(null);
  const callbacksRef = useRef({ onMove, onResize, onSnap, onSnapPreviewChange });
  callbacksRef.current = { onMove, onResize, onSnap, onSnapPreviewChange };
  previewRef.current = preview;

  useEffect(() => {
    const onMove_ = (e: PointerEvent) => {
      const current = drag.current;
      if (!current) return;
      const dx = e.clientX - current.pointerX;
      const dy = e.clientY - current.pointerY;

      if (current.mode === 'move') {
        /* If dragging a maximized or snapped window beyond a tiny threshold, smoothly detach to floating bounds */
        if (
          !current.unsnappedDuringDrag &&
          (current.startStatus === 'maximized' || current.startSnapZone) &&
          Math.hypot(dx, dy) >= DRAG_DETACH_THRESHOLD_PX
        ) {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const floating = clampBounds(
            current.restoreBounds ?? { x: 120, y: 72, width: 720, height: 500 },
            vw,
            vh
          );
          const ratioX = Math.min(0.85, Math.max(0.15, e.clientX / Math.max(vw, 1)));
          const anchoredX = Math.round(e.clientX - floating.width * ratioX);
          const anchoredY = Math.max(0, Math.round(e.clientY - 19));
          const detachedBounds: WindowBounds = {
            ...floating,
            x: anchoredX,
            y: anchoredY,
          };
          current.bounds = detachedBounds;
          current.pointerX = e.clientX;
          current.pointerY = e.clientY;
          current.unsnappedDuringDrag = true;
          setDetachedFromMax(true);
          previewRef.current = detachedBounds;
          setPreview(detachedBounds);
        } else if (
          current.unsnappedDuringDrag ||
          (current.startStatus !== 'maximized' && !current.startSnapZone)
        ) {
          const next = {
            ...current.bounds,
            x: current.bounds.x + dx,
            y: current.bounds.y + dy,
          };
          previewRef.current = next;
          setPreview(next);
        }

        const zone = detectSnapZone(e.clientX, e.clientY, window.innerWidth);
        if (zone !== activeSnapZoneRef.current) {
          activeSnapZoneRef.current = zone;
          callbacksRef.current.onSnapPreviewChange(zone);
        }
      } else {
        const next = {
          ...current.bounds,
          width: Math.max(320, current.bounds.width + dx),
          height: Math.max(220, current.bounds.height + dy),
        };
        previewRef.current = next;
        setPreview(next);
      }
    };

    const onUp = () => {
      const currentDrag = drag.current;
      if (!currentDrag) return;
      const snapZone = activeSnapZoneRef.current;
      const final = previewRef.current;

      if (activeSnapZoneRef.current !== null) {
        activeSnapZoneRef.current = null;
        callbacksRef.current.onSnapPreviewChange(null);
      }

      if (currentDrag.mode === 'move' && snapZone) {
        callbacksRef.current.onSnap(snapZone);
      } else if (final) {
        if (currentDrag.mode === 'move') {
          /* Only commit move if actually dragged or detached */
          if (
            currentDrag.unsnappedDuringDrag ||
            (currentDrag.startStatus !== 'maximized' &&
              !currentDrag.startSnapZone &&
              (final.x !== currentDrag.bounds.x || final.y !== currentDrag.bounds.y))
          ) {
            callbacksRef.current.onMove(final);
          }
        } else {
          callbacksRef.current.onResize(final);
        }
      }

      drag.current = null;
      previewRef.current = null;
      setPreview(null);
      setDetachedFromMax(false);
    };

    window.addEventListener('pointermove', onMove_);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove_);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const beginDrag = (e: ReactPointerEvent, mode: 'move' | 'resize') => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.button !== 0) return;
    if (mode === 'resize' && win.status === 'maximized') return;
    e.preventDefault();
    onFocus();
    previewRef.current = win.bounds;
    if (win.status !== 'maximized') {
      setPreview(win.bounds);
    }
    drag.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      bounds: win.bounds,
      mode,
      unsnappedDuringDrag: false,
      startStatus: win.status,
      startSnapZone: win.snapZone,
      restoreBounds: win.restoreBounds,
    };
  };

  if (win.status === 'minimized') return null;
  const isMax = win.status === 'maximized' && !detachedFromMax;
  const isSnapped = Boolean(win.snapZone) && !preview;

  return (
    <section
      className={`wf ${active ? 'wf--active' : ''} ${isMax ? 'wf--max' : ''} ${isSnapped ? 'wf--snapped' : ''}`}
      style={
        isMax
          ? { zIndex, position: 'absolute', inset: 0, width: 'auto', height: 'auto' }
          : { zIndex, left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }
      }
      onPointerDown={onFocus}
      aria-label={`${win.title} window`}
    >
      {/* Title bar */}
      <header
        className="wf-titlebar"
        onPointerDown={e => beginDrag(e, 'move')}
        onDoubleClick={onToggleMaximize}
      >
        {/* Traffic lights — LEFT side */}
        <div className="wf-controls" aria-label="Window controls">
          <button type="button" className="wf-btn wf-close" onClick={onClose} aria-label={`Close ${win.title}`} title="Close" />
          <button type="button" className="wf-btn wf-minimize" onClick={onMinimize} aria-label={`Minimize ${win.title}`} title="Minimize" />
          <button type="button" className="wf-btn wf-maximize" onClick={onToggleMaximize} aria-label={isMax ? `Restore ${win.title}` : `Maximize ${win.title}`} title={isMax ? 'Restore' : 'Maximize (Alt+Up)'} />
        </div>

        {/* Centered title */}
        <span className="wf-title">{win.title}</span>

        {/* Right-side quick tile & snap actions (matches left width so title remains centered) */}
        <div className="wf-tile-actions" aria-label="Window tiling">
          <button
            type="button"
            className={`wf-tile-btn ${win.snapZone === 'left' && !isMax ? 'is-active' : ''}`}
            onClick={() => onSnap('left')}
            aria-label={`Snap ${win.title} to left half`}
            title="Tile left half (Alt + [)"
          >
            <PanelLeft size={12} />
          </button>
          <button
            type="button"
            className={`wf-tile-btn ${win.snapZone === 'right' && !isMax ? 'is-active' : ''}`}
            onClick={() => onSnap('right')}
            aria-label={`Snap ${win.title} to right half`}
            title="Tile right half (Alt + ])"
          >
            <PanelRight size={12} />
          </button>
          <button
            type="button"
            className={`wf-tile-btn ${isMax ? 'is-active' : ''}`}
            onClick={onToggleMaximize}
            aria-label={isMax ? `Restore ${win.title}` : `Maximize ${win.title}`}
            title={isMax ? 'Restore floating size (Alt + Down)' : 'Maximize (Alt + Up)'}
          >
            {isMax ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </div>
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
