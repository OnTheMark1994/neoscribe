import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import "./RightClickWindow.css"
import { closeRightClickWindow, setShowSettingsWindow } from '../../Global/ReduxSlices/WindowSlice';

// Default menu options to show when no custom options are provided
const DEFAULT_OPTIONS = [
  {
    title: 'Settings',
    onClick: (dispatch) => dispatch(setShowSettingsWindow(true))
  },
  {
    title: 'Cancel',
    onClick: (dispatch) => dispatch(closeRightClickWindow())
  }
];

export default function RightClickWindow() {
  const dispatch = useDispatch();
  const ignoreNextClickRef = useRef(true);
  const elementRef = useRef() 

  // Determines if the right click window shows
  const showWindow = useSelector(state => state.windowSlice.showRightClickWindow) 
  const left = useSelector(state => state.windowSlice.rightClickWindowLeft) 
  const top = useSelector(state => state.windowSlice.rightClickWindowTop) 
  
  // Get the menu options from Redux state, use defaults if null or empty
  const options = useSelector(state => state.windowSlice.rightClickMenuOptions) || []
  const displayOptions = options?.length > 0 ? options : DEFAULT_OPTIONS;

  function closeWindow(){
    ignoreNextClickRef.current = true
    dispatch(closeRightClickWindow());
  }

  // Set up click-away detection with a delay
  useEffect(() => {
    if (!showWindow) return;



    const handleClickOutside = (event) => {
      
      if (elementRef.current && !elementRef.current.contains(event.target)){
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
      {displayOptions.map((option, i) => (
        <div 
          className="rightClickOption" 
          key={i}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation();
            // Call option's onClick if it exists
            if (option.onClick) option.onClick(dispatch);
            // Close the window after action
            dispatch(closeRightClickWindow());
          }}
        >
          {option.title}
        </div>
      ))}
    </div>
  );
}