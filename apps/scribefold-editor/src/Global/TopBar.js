/*
 
  This contains the navigation and controls for the application 

  File
    new
    open
    save
    save as
    Settings

  Edit
    Undo
    Redo
    View Log (add this later not now so leave it out for now)
      shows a log of the undo redo actions with ability to revert to them

  View
    "Full Screen (F11)" (or "Exit FUll Screen (Esc)"" if it already in full screen)
      toggles F11 full screen mode
      View Settings
        sets redux menuSlice.showSettings boolean AND menuSlice.settingsInitialTab "view" with the same dispacthed action
        like this: onClick={dispatch(showSettingsMenu("view"))}
      
    AI
      Show AI Chat
      AI Settings
        sets redux menuSlice.showSettings boolean AND menuSlice.settingsInitialTab "ai" with the same dispacthed action
        like this: onClick={dispatch(showSettingsMenu("ai"))} (so don't need a function for it just dispatche it directly in the onClick)
      Token Usage FAQ
        shows help menu scrolling directly to and opening the section about token usage
        gives instructions on how to toggle the ai share with the eye icons
        best practices
        how the ai chat bar works in the next section etc
        
  Full screen F11 display:
    In normal mode top bar is always there
    In F11 mode:
      Top bar does not show in full screen mode
      It is in a transparent container that does always show
      when user hovers over the trasparent container an opacity and transform css transition moves it into view
  
  File name
    the file path is saved in the editor slice
    the file name is shown at the top ceter of the topbar
    if it is modified and requires save show a * at the end of the file name

  Download button
    if on web (not desktop electron) show the download app button at the rop right of the bar

*/

import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleFullscreenActive } from './ReduxSlices/MenuSlice';
import { setAiModeActive } from './ReduxSlices/AiSlice';
import { setShowHelpWindow, setShowSettingsWindow } from './ReduxSlices/WindowSlice';
import './TopBar.css';

// Detect whether we are running in the browser (no Electron preload API).
const IS_WEB = !window?.electronAPI;

export default function TopBar() {
  // Redux dispatch for menu actions.
  const dispatch = useDispatch();

  // Used to detect clicks outside of the menu dropdown area.
  const menuRef = useRef(null);

  // Tracks which top-level menu (tobar option) is currently open (file/edit/view/ai/help).
  const [activeMenu, setActiveMenu] = useState(null);

  // Editor/file state for displaying the current filename.
  const filepath = useSelector(state => state.editorSlice.filepath);
  const modified = useSelector(state => state.editorSlice.modified);

  // Fullscreen state controls whether the top bar is visually hidden.
  const fullscreenActive = useSelector(state => state.menuSlice.fullscreenActive);

  // Controls whether the AI chat sidebar is visible.
  const aiModeActive = useSelector(state => state.aiSlice.aiModeActive);

  // Derive file name from path (handles both / and \ path separators).
  const fileName = filepath ? filepath.split(/[/\\]/).pop() : 'Untitled';

  // Add a trailing * to indicate unsaved changes.
  const displayName = `${fileName}${modified ? '*' : ''}`;

  useEffect(() => {
    const handleKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      const key = String(e.key || '').toLowerCase();
      const shift = e.shiftKey;

      if (key === 's') {
        e.preventDefault();
        if (shift) saveFileAs();
        else saveFile();
      } else if (key === 'o') {
        e.preventDefault();
        openFile();
      } else if (key === 'n') {
        e.preventDefault();
        newFile();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Close dropdown menus when user clicks outside of the top bar.
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper used by many menu items to close the active dropdown.
  const closeMenu = () => setActiveMenu(null);

  // File operation functions
  const newFile = () => {
    console.log('New file action');
    // TODO: Implement new file logic
    closeMenu();
  };

  const openFile = () => {
    console.log('Open file action');
    // TODO: Implement open file logic
    closeMenu();
  };

  const saveFile = () => {
    console.log('Save file action');
    // TODO: Implement save file logic
    closeMenu();
  };

  const saveFileAs = () => {
    console.log('Save As file action');
    // TODO: Implement save as logic
    closeMenu();
  };

  // If fullscreen mode is active, the CSS class hides the bar (hover container still exists).
  const barClasses = `topBar ${fullscreenActive ? 'topBarHidden' : ''}`;

  return (
    <div className="topBarContainer">
      <div className={barClasses} ref={menuRef}>
        <div className="topBarLeft">
          <img
            src="/icon-images/scribefold-ai-icon-png.png"
            alt=""
            className="topBarLogo"
          />

          <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'file' ? 'active' : ''}`}
              // Toggle the File dropdown.
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
            >
              File
            </button>
            {/* Dropdown content only mounts while this menu is active. */}
            {activeMenu === 'file' && (
              <div className="topBarDropdown">
                <button onClick={newFile}>
                  <span>New</span><span className="shortcut">Ctrl+N</span>
                </button>

                <button onClick={openFile}>
                  <span>Open</span><span className="shortcut">Ctrl+O</span>
                </button>

                <div className="topBarDivider" />

                <button onClick={saveFile}>
                  <span>Save</span><span className="shortcut">Ctrl+S</span>
                </button>

                <button onClick={saveFileAs}>
                  <span>Save As</span><span className="shortcut">Ctrl+Shift+S</span>
                </button>
                <div className="topBarDivider" />
                <button
                  onClick={() => {
                    closeMenu();
                    dispatch(setShowSettingsWindow(true));
                  }}
                >
                  <span>Settings</span><span className="shortcut">Ctrl+,</span>
                </button>
              </div>
            )}
          </div>

          <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'edit' ? 'active' : ''}`}
              // Toggle the Edit dropdown.
              onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
            >
              Edit
            </button>
            {/* Dropdown content only mounts while this menu is active. */}
            {activeMenu === 'edit' && (
              <div className="topBarDropdown">
                <button onClick={closeMenu} disabled><span>Undo</span><span className="shortcut">Ctrl+Z</span></button>
                <button onClick={closeMenu} disabled><span>Redo</span><span className="shortcut">Ctrl+Y</span></button>
              </div>
            )}
          </div>

          <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'view' ? 'active' : ''}`}
              // Toggle the View dropdown.
              onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
            >
              View
            </button>
            {/* Dropdown content only mounts while this menu is active. */}
            {activeMenu === 'view' && (
              <div className="topBarDropdown">
                {/* Fullscreen toggle is the only View action wired up currently. */}
                <button
                  onClick={() => {
                    // Close the menu first so the UI feels responsive.
                    closeMenu();
                    // Tells redux to toggle the fullscreenActive flag.
                    dispatch(toggleFullscreenActive());
                  }}
                >
                  <span>{fullscreenActive ? 'Exit Full Screen' : 'Full Screen'}</span>
                  <span className="shortcut">F11</span>
                </button>
                <div className="topBarDivider" />
                <button
                  onClick={() => {
                    closeMenu();
                    dispatch(setShowSettingsWindow('Display'));
                  }}
                >
                  <span>Display Settings</span>
                </button>
              </div>
            )}
          </div>

          <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'ai' ? 'active' : ''}`}
              // Toggle the AI dropdown.
              onClick={() => setActiveMenu(activeMenu === 'ai' ? null : 'ai')}
            >
              AI
            </button>
            {/* Dropdown content only mounts while this menu is active. */}
            {activeMenu === 'ai' && (
              <div className="topBarDropdown">
                <button
                  onClick={() => {
                    closeMenu();
                    dispatch(setAiModeActive());
                  }}
                >
                  <span>{aiModeActive ? 'Hide AI Chat' : 'Show AI Chat'}</span>
                </button>
                <button
                  onClick={() => {
                    closeMenu();
                    dispatch(setShowSettingsWindow('AI'));
                  }}
                >
                  <span>AI Settings</span>
                </button>
                <div className="topBarDivider" />
                <button
                  onClick={() => {
                    closeMenu();
                    dispatch(setShowHelpWindow('ai-help'));
                  }}
                >
                  <span>Token Usage FAQ</span>
                </button>
              </div>
            )}
          </div>

          <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'help' ? 'active' : ''}`}
              // Help opens immediately (no dropdown).
              onClick={() => {
                closeMenu();
                dispatch(setShowHelpWindow(true));
              }}
            >
              Help
            </button>
          </div>
        </div>

        <div className="topBarCenter">
          {/* Current filename (+* when modified) */}
          <span className="topBarFilename">{displayName}</span>
        </div>

        <div className="topBarRight">
          {IS_WEB && (
            // In the web build we show a "Desktop App" link (Electron apps don't need it).
            <a
              href="#"
              className="topBarDesktopLink"
              title="Download Desktop App"
              onClick={(e) => {
                e.preventDefault();
                closeMenu();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              <span>Desktop App</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
