import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import "./RightClickWindow.css"
import { closeRightClickWindow } from '../../Global/ReduxSlices/WindowSlice';

export default function RightClickWindow() {
  const dispatch = useDispatch();
  const ignoreNextClickRef = useRef(true);
  const elementRef = useRef() 

  // Determines if the right click window shows
  const showWindow = useSelector(state => state.windowSlice.showRightClickWindow) 
  const left = useSelector(state => state.windowSlice.rightClickWindowLeft) 
  const top = useSelector(state => state.windowSlice.rightClickWindowTop) 
  
  // Get the array from the optionsArrays based on the redux.windowSlice.optionsType 
  const options = []

  function closeWindow(){
    ignoreNextClickRef.current = true
    dispatch(closeRightClickWindow());
  }

  // Set up click-away detection with a delay
  useEffect(() => {
    if (!showWindow) return;



    const handleClickOutside = (event) => {
      
      if (elementRef.current && event.target !== elementRef.current){
        closeWindow()
      }
    };

    // Also close on escape key
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        closeWindow()
      }
    };

    // Prevents the browsers click menu showing over it on mouse up
    const handleContextMenu = (event) => {
      event.preventDefault()
    }

    // Mousedown to close the right click menu when clicking outside of it
    document.addEventListener('mousedown', handleClickOutside);
    // Close right click menu on escape
    document.addEventListener('keydown', handleEscapeKey);
    // Prevents the browsers click menu showing over it on mouse up
    elementRef.current?.addEventListener('contextmenu', handleContextMenu);
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      elementRef.current?.removeEventListener("contextmenu", handleContextMenu)
    };
  }, [showWindow, dispatch]);

  // The window shows conditionally based on redux windowSlice.showRightClickWindow
  if(!showWindow) return null

  return (
    <div 
      ref={elementRef}
      className="rightClickWindow" 
      style={{ left: `${left}px`, top: `${top}px` }}
      onClick={(e) => {
        // Stop propagation to prevent triggering click outside
        e.stopPropagation();
      }}
    >
      {options.map((option, i) => (
        <div 
          className="rightClickOption" 
          key={i}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation();
            // Call option's onClick if it exists
            if (option.onClick) option.onClick();
            // Close the window after action
            dispatch({ type: 'windowSlice/closeRightClickMenu' });
          }}
        >
          {option.title}
        </div>
      ))}
    </div>
  );
}