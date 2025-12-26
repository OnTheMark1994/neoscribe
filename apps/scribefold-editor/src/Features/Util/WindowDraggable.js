import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './Window.css';
import './WindowDraggable.css';

export default function WindowDraggable({
  title,
  open,
  onClose,
  children,
  className = '',
  initialPosition,
}) {
  const startPos = useMemo(() => {
    const x = typeof initialPosition?.x === 'number' ? initialPosition.x : 40;
    const y = typeof initialPosition?.y === 'number' ? initialPosition.y : 90;
    return { x, y };
  }, [initialPosition]);

  const [pos, setPos] = useState(startPos);
  const dragRef = useRef({ dragging: false, startMouseX: 0, startMouseY: 0, startX: 0, startY: 0 });

  useEffect(() => {
    setPos(startPos);
  }, [startPos]);

  const onMouseMove = useCallback((e) => {
    const st = dragRef.current;
    if (!st.dragging) return;

    const dx = e.clientX - st.startMouseX;
    const dy = e.clientY - st.startMouseY;

    setPos({
      x: Math.max(0, st.startX + dx),
      y: Math.max(0, st.startY + dy),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  useEffect(() => {
    if (!open) return;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [open, onMouseMove, onMouseUp]);

  const handleTopBarMouseDown = useCallback((e) => {
    // Ignore drag if the close button (or its children) is clicked.
    const target = e.target;
    if (target && target.closest && target.closest('.windowCloseButton')) return;

    dragRef.current.dragging = true;
    dragRef.current.startMouseX = e.clientX;
    dragRef.current.startMouseY = e.clientY;
    dragRef.current.startX = pos.x;
    dragRef.current.startY = pos.y;
  }, [pos.x, pos.y]);

  if (!open) return null;

  return (
    <div className="windowDraggableRoot" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
      <div className={`windowContainer windowDraggableContainer ${className}`}>
        <div className="windowTopBar windowDraggableTopBar" onMouseDown={handleTopBarMouseDown}>
          <div className="windowTitle">{title}</div>
          <button
            className="windowCloseButton"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="windowContent">
          {children}
        </div>
      </div>
    </div>
  );
}
