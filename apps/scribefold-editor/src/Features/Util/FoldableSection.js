/*
 
 
 
    This is a container shows foldable content like in a long help section or parts of dev logs,
    There is a border radius, border around the whole thing, and a top bar that always shows with a title and an open/close button

    Title Bar:
      +- button on the top right allows open close
        it is a small square or rectangle that is about 90% of the height of the top bar
        internal open state is toggled by the +- button
      a title in the center set by props or default "Section"

    it expands and shows the inner content when open

    Overview: 
    
    const open = usestate

    <div border css>
        <top bar>  
            title  
            +- button
                onclick open = !open
        <topbar/>
        <conent container>
        
            {children}
        
        <conent container/>
    <div/>



*/
import React, { useEffect, useRef, useState } from 'react';
import './FoldableSection.css';

export default function FoldableSection({ title, defaultOpen = false, scrollTo = false, children }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const containerRef = useRef(null);

  useEffect(() => {
    setOpen(Boolean(defaultOpen));
  }, [defaultOpen]);

  useEffect(() => {
    if (!scrollTo) return;
    if (!containerRef.current) return;
    containerRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [scrollTo]);

  return (
    <div className="foldableSection" ref={containerRef}>
      <div className="foldableSectionTopBar">
        <div className="foldableSectionTitle">{title || 'Section'}</div>
        <button
          type="button"
          className="foldableSectionToggle"
          onClick={() => setOpen(o => !o)}
          title={open ? 'Close Section' : 'Open Section'}
        >
          {open ? '-' : '+'}
        </button>
      </div>
      {open ? (
        <div className="foldableSectionContent">
          {children}
        </div>
      ) : null}
    </div>
  );
}
