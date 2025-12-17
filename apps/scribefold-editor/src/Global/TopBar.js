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
    the file name is shown at the top cener of the topbar
    if it is modified and requires save show a * at the end of the file name

  Download button
    if on web (not desktop electron) show the download app button at the rop right of the bar

*/

import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleFullscreenActive } from './ReduxSlices/MenuSlice';
import './TopBar.css';

const IS_WEB = !window?.electronAPI;

export default function TopBar() {
  const dispatch = useDispatch();
  const menuRef = useRef(null);
  const [activeMenu, setActiveMenu] = useState(null);

  const filepath = useSelector(state => state.editorSlice.filepath);
  const modified = useSelector(state => state.editorSlice.modified);
  const fullscreenActive = useSelector(state => state.menuSlice.fullscreenActive);

  const fileName = filepath ? filepath.split(/[/\\]/).pop() : 'Untitled';
  const displayName = `${fileName}${modified ? '*' : ''}`;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeMenu = () => setActiveMenu(null);

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
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div className="topBarDropdown">
                <button onClick={closeMenu}><span>New</span><span className="shortcut">Ctrl+N</span></button>
                <button onClick={closeMenu}><span>Open</span><span className="shortcut">Ctrl+O</span></button>
                <div className="topBarDivider" />
                <button onClick={closeMenu}><span>Save</span><span className="shortcut">Ctrl+S</span></button>
                <button onClick={closeMenu}><span>Save As</span><span className="shortcut">Ctrl+Shift+S</span></button>
                <div className="topBarDivider" />
                <button onClick={closeMenu}><span>Settings</span><span className="shortcut">Ctrl+,</span></button>
              </div>
            )}
          </div>

          <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'edit' ? 'active' : ''}`}
              onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
            >
              Edit
            </button>
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
              onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
            >
              View
            </button>
            {activeMenu === 'view' && (
              <div className="topBarDropdown">
                <button
                  onClick={() => {
                    closeMenu();
                    dispatch(toggleFullscreenActive());
                  }}
                >
                  <span>{fullscreenActive ? 'Exit Full Screen' : 'Full Screen'}</span>
                  <span className="shortcut">F11</span>
                </button>
                <div className="topBarDivider" />
                <button onClick={closeMenu}><span>View Settings</span></button>
              </div>
            )}
          </div>

          <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveMenu(activeMenu === 'ai' ? null : 'ai')}
            >
              AI
            </button>
            {activeMenu === 'ai' && (
              <div className="topBarDropdown">
                <button onClick={closeMenu}><span>Show AI Chat</span></button>
                <button onClick={closeMenu}><span>AI Settings</span></button>
                <div className="topBarDivider" />
                <button onClick={closeMenu}><span>Token Usage FAQ</span></button>
              </div>
            )}
          </div>

          <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'help' ? 'active' : ''}`}
              onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
            >
              Help
            </button>
            {activeMenu === 'help' && (
              <div className="topBarDropdown">
                <button onClick={closeMenu}><span>Help</span></button>
              </div>
            )}
          </div>
        </div>

        <div className="topBarCenter">
          <span className="topBarFilename">{displayName}</span>
        </div>

        <div className="topBarRight">
          {IS_WEB && (
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
