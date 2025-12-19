import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import "./RightClickWindow.css"
import { closeRightClickWindow } from '../../Global/ReduxSlices/WindowSlice';

export default function RightClickWindow() {
  const dispatch = useDispatch();
  const windowRef = useRef(null);
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
      console.log("handleClickOutside ignoreNextClickRef.current:", ignoreNextClickRef.current)
      // Skip if we're ignoring this click (the one that opened the window)
      if(ignoreNextClickRef.current){
        ignoreNextClickRef.current = false
        return
      }

      // dispatch(closeRightClickWindow());
      if (windowRef.current && event.target !== windowRef.current){
        closeWindow()
      }else{
        console.log("not closing")

      }

    };

    // Also close on escape key
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        closeWindow()
      }
    };

    // Use mousedown instead of click for better timing
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showWindow, dispatch]);

  // The window shows conditionally based on redux windowSlice.showRightClickWindow
  if(!showWindow) return null

  return (
    <div 
      ref={windowRef}
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
            e.stopPropagation();
            // Call option's onClick if it exists
            if (option.onClick) option.onClick();
            // Close the window after action
            dispatch({ type: 'windowSlice/closeRightClickMenu' });
          }}
          ref={elementRef}
        >
          {option.title}
        </div>
      ))}
    </div>
  );
}