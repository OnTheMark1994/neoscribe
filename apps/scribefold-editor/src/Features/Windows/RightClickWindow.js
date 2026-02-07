import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import "./RightClickWindow.css"
import { closeRightClickWindow, setShowSettingsWindow } from '../../Global/ReduxSlices/WindowSlice';

// Default menu options to show when no custom options are provided
const DEFAULT_OPTIONS = [
  {
    title: 'Cut',
    onClick: (dispatch, editorRef) => {
      if (editorRef?.current) {
        const view = editorRef.current;
        const state = view.state;
        const selection = state.selection.main;
        const text = state.doc.sliceString(selection.from, selection.to);

        // Copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
          // Delete the selection
          view.dispatch({
            changes: {
              from: selection.from,
              to: selection.to,
              insert: ''
            }
          });
          console.log('[RightClickWindow] Cut:', text);
        });
      }
    }
  },
  {
    title: 'Copy',
    onClick: (dispatch, editorRef) => {
      if (editorRef?.current) {
        const view = editorRef.current;
        const state = view.state;
        const selection = state.selection.main;
        const text = state.doc.sliceString(selection.from, selection.to);

        navigator.clipboard.writeText(text).then(() => {
          console.log('[RightClickWindow] Copied:', text);
        });
      }
    }
  },
  {
    title: 'Paste',
    onClick: (dispatch, editorRef) => {
      if (editorRef?.current) {
        navigator.clipboard.readText().then(text => {
          const view = editorRef.current;
          const state = view.state;
          const pos = state.selection.main.head;

          view.dispatch({
            changes: {
              from: pos,
              to: pos,
              insert: text
            }
          });
          console.log('[RightClickWindow] Pasted:', text);
        });
      }
    }
  },
  // Shows a seperator
  {
    title: "#seperator"
  },
  {
    title: 'Settings',
    onClick: (dispatch) => dispatch(setShowSettingsWindow(true))
  },
  {
    title: 'Cancel',
    onClick: (dispatch) => dispatch(closeRightClickWindow())
  }
];

export default function RightClickWindow({ editorRef }) {
  const dispatch = useDispatch();
  const elementRef = useRef()

  // Determines if the right click window shows
  const showWindow = useSelector(state => state.windowSlice.showRightClickWindow) 
  const left = useSelector(state => state.windowSlice.rightClickWindowLeft) 
  const top = useSelector(state => state.windowSlice.rightClickWindowTop) 
  
  // Get the menu options from Redux state, use defaults if null or empty
  const options = useSelector(state => state.windowSlice.rightClickMenuOptions) || []
  // Convert string suggestions to objects with title property
  const formattedOptions = options.map(opt => typeof opt === 'string' ? { title: opt } : opt);
  // Merge dictionary suggestions with default options
  const displayOptions = formattedOptions?.length > 0 ? [...formattedOptions, ...DEFAULT_OPTIONS] : DEFAULT_OPTIONS;

  function closeWindow(){
    dispatch(closeRightClickWindow());
  }

  // Handle option click - replace word if it's a spellcheck suggestion
  const handleOptionClick = (option, index) => {
    console.log('[RightClickWindow] Option clicked:', option);

    // If it's a spellcheck suggestion (no onClick property), replace the word
    if (!option.onClick && editorRef?.current) {
      const view = editorRef.current;
      const state = view.state;

      // Get the current cursor position
      const pos = state.selection.main.head;

      // Find the word at the cursor position
      const word = state.wordAt(pos);
      if (word) {
        // Replace the word with the selected suggestion
        view.dispatch({
          changes: {
            from: word.from,
            to: word.to,
            insert: option.title
          }
        });
        console.log('[RightClickWindow] Replaced word with:', option.title);
      }
    } else if (option.onClick) {
      // Handle default menu options - pass editorRef if needed
      option.onClick(dispatch, editorRef);
    }

    closeWindow();
  };

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
    // const handleContextMenu = (event) => {
    //   event.preventDefault()
    // }

    // Mousedown to close the right click menu when clicking outside of it
    document.addEventListener('mousedown', handleClickOutside);
    // Close right click menu on escape
    document.addEventListener('keydown', handleEscapeKey);
    // Prevents the browsers click menu showing over it on mouse up
    // elementRef.current?.addEventListener('contextmenu', handleContextMenu);
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      // elementRef.current?.removeEventListener("contextmenu", handleContextMenu)
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
      {displayOptions.map((option, i) => {
        // Check if this is a separator option
        const isSeparator = typeof option === 'object' && option.title === '#seperator';
        // Check if this is the first default option after spelling suggestions
        const isAfterSpellingSuggestions = options?.length > 0 && i === options.length;

        return (
          <React.Fragment key={i}>
            {isSeparator || isAfterSpellingSuggestions? (
              <div className="rightClickSeparator"></div>
            ) : (
              <div 
                className="rightClickOption" 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation();
                  handleOptionClick(option, i);
                }}
              >
                {option.title}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}