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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleFullscreenActive } from './ReduxSlices/MenuSlice';
import { setShowFileEncryptionWindow, setShowHelpWindow, setShowSettingsWindow } from './ReduxSlices/WindowSlice';
import './TopBar.css';
import { updateSetting } from './ReduxSlices/SettingsSlice';
import { fileOpened, resetEditor, setFilepath, setModified } from './ReduxSlices/EditorSlice';
import { openFile as openFileIO, saveFile as saveFileIO, saveFileAs as saveFileAsIO } from './FileIO';
import { getEditorText, setEditorText } from './EditorRefHelpers';
import { unfoldAll } from '@codemirror/language';
import { customFoldAll } from '../Features/Editors/CodeMirror/EditorSetup';
import { undo, redo } from '@codemirror/commands';

// Detect whether we are running in Electron or browser
const IS_ELECTRON = Boolean(window.electronAPI);

export default function TopBar({ editorRef }) {
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

  // Settings window state
  const showSettingsWindow = useSelector(state => state.windowSlice.showSettingsWindow);

  // Help window state
  const showHelpWindow = useSelector(state => state.windowSlice.showHelpWindow);

  // Controls whether the AI chat sidebar is visible.
  const aiModeActive = useSelector(state => state.settingsSlice.settingsObject?.aiModeActive);

  // Derive file name from path (handles both / and \ path separators).
  const fileName = filepath ? filepath.split(/[/\\]/).pop() : 'Untitled';

  // Add a trailing * to indicate unsaved changes.
  const displayName = `${fileName}${modified ? '*' : ''}`;

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

  // Warn user before closing tab/refreshing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Only prevent closing in web browser, not in Electron
      // Electron has its own close handling that can be blocked by beforeunload
      if (modified && !window.electronAPI?.isElectron) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to close?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [modified]);

  // Helper used by many menu items to close the active dropdown.
  const closeMenu = useCallback(() => setActiveMenu(null), []);

  // File operation functions
  const newFile = useCallback(() => {
    if(modified){
      const confirmed = window.confirm('You have unsaved changes. Continue?');
      if(!confirmed) return;
    }

    dispatch(resetEditor());
    setEditorText(editorRef, '');
    dispatch(setModified(false));
    closeMenu();
  }, [closeMenu, dispatch, modified, editorRef]);

  const openFile = useCallback(async () => {
    if(modified){
      const confirmed = window.confirm('You have unsaved changes. Continue?');
      if(!confirmed) return;
    }

    try {
      const result = await openFileIO();
      if(!result?.success) {
        closeMenu();
        return;
      }

      const nextFilepath = String(result.filePath || result.fileName || '');

      dispatch(fileOpened({ filepath: nextFilepath }));

      if (result.encrypted) {
        dispatch(setShowFileEncryptionWindow({
          mode: 'unlock',
          filePath: nextFilepath,
          encryptedText: String(result.encryptedText ?? ''),
        }));
        dispatch(setModified(false));
        closeMenu();
        return;
      }

      const content = String(result.content ?? '');

      setEditorText(editorRef, content);
      dispatch(setModified(false));
    } catch (e) {
      console.error('[TopBar] openFile failed', e);
    }
    closeMenu();
  }, [closeMenu, dispatch, modified, editorRef]);

  const saveFile = useCallback(async () => {
    try {
      const content = getEditorText(editorRef);
      const result = await saveFileIO({ filePath: filepath || '', fileName, content });
      if(result?.success){
        dispatch(setModified(false));
        if(result.filePath) dispatch(setFilepath(result.filePath));
      }
    } catch (e) {
      console.error('[TopBar] saveFile failed', e);
    }
    closeMenu();
  }, [closeMenu, dispatch, fileName, filepath, editorRef]);

  const saveFileAs = useCallback(async () => {
    try {
      const content = getEditorText(editorRef);
      const result = await saveFileAsIO({ content, suggestedName: fileName, sourceFilePath: filepath || '' });
      if(result?.success){
        dispatch(setModified(false));
        if(result.filePath) dispatch(setFilepath(result.filePath));
        else if(result.fileName) dispatch(setFilepath(result.fileName));
      }
    } catch (e) {
      console.error('[TopBar] saveFileAs failed', e);
    }
    closeMenu();
  }, [closeMenu, dispatch, fileName, filepath, editorRef]);

  const handleFoldAll = useCallback(() => {
    const view = editorRef.current;
    if (view) {
      customFoldAll(view);
    }
    closeMenu();
  }, [editorRef, closeMenu]);

  const handleUnfoldAll = useCallback(() => {
    const view = editorRef.current;
    if (view) {
      unfoldAll(view);
    }
    closeMenu();
  }, [editorRef, closeMenu]);

  // Undo handler
  const handleUndo = useCallback(() => {
    const view = editorRef.current;
    if (view) {
      undo(view);
    }
    closeMenu();
  }, [editorRef, closeMenu]);

  // Redo handler
  const handleRedo = useCallback(() => {
    const view = editorRef.current;
    if (view) {
      redo(view);
    }
    closeMenu();
  }, [editorRef, closeMenu]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = String(e.key || '').toLowerCase();

      // Escape key - close all windows and menus (don't prevent default)
      if (key === 'escape') {
        if (showSettingsWindow) {
          dispatch(setShowSettingsWindow(false));
        }
        if (showHelpWindow) {
          dispatch(setShowHelpWindow(false));
        }
        if (activeMenu) {
          setActiveMenu(null);
        }
        return;
      }

      if (!ctrl) return;

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
      } else if (key === '.') {
        e.preventDefault();
        dispatch(setShowSettingsWindow(true));
      } else if (key === 'k') {
        e.preventDefault();
        if (shift) handleUnfoldAll();
        else handleFoldAll();
      }

    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [newFile, openFile, saveFile, saveFileAs, handleFoldAll, handleUnfoldAll, showSettingsWindow, showHelpWindow, activeMenu]);

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

                <button onClick={openFile}  title={IS_ELECTRON ? "Open a file":"Browser can't open from file system automatically so you can select a file."}>
                  <span>{IS_ELECTRON ? "Open":"Open / Upload"}</span><span className="shortcut">Ctrl+O</span>
                </button>

                <div className="topBarDivider" />

                <button onClick={saveFile} title={IS_ELECTRON ? "Save File":"Browser can't save to file system this downloads the file."}>
                  <span>{IS_ELECTRON ? "Save":"Save / Download"}</span><span className="shortcut">Ctrl+S</span>
                </button>

                {IS_ELECTRON &&
                  <button onClick={saveFileAs}>
                    <span>{"Save As"}</span><span className="shortcut">Ctrl+Shift+S</span>
                  </button>
                }
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

          {/* <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'edit' ? 'active' : ''}`}
              // Toggle the Edit dropdown.
              onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div className="topBarDropdown">
              </div>
            )}
          </div> */}

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
                    dispatch(updateSetting({key: "aiModeActive", value: !aiModeActive}));
                    closeMenu();
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

          <div className="topBarMenuItem">
            <button
              className={`topBarMenuButton ${activeMenu === 'tools' ? 'active' : ''}`}
              onClick={() => setActiveMenu(activeMenu === 'tools' ? null : 'tools')}
            >
              Tools
            </button>
            {activeMenu === 'tools' && (
              <div className="topBarDropdown">
                <button onClick={handleUndo}>
                  <span>Undo</span><span className="shortcut">Ctrl+Z</span>
                </button>
                <button onClick={handleRedo}>
                  <span>Redo</span><span className="shortcut">Ctrl+Y</span>
                </button>
                <div className="topBarDivider" />
                <button onClick={handleFoldAll}>
                  <span>Fold All</span><span className="shortcut">Ctrl+K</span>
                </button>
                <button onClick={handleUnfoldAll}>
                  <span>Unfold All</span><span className="shortcut">Ctrl+Shift+K</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="topBarCenter">
          {/* Current filename (+* when modified) */}
          <span className="topBarFilename">{displayName}</span>
        </div>

        <div className="topBarRight">
          {!IS_ELECTRON && (
            // In the web build we show a "Desktop App" link (Electron apps don't need it).
            <a
              href={process.env.REACT_APP_WEB_PORTAL_URL+'/#/downloads'}
              target="_blank"
              className="topBarDesktopLink"
              title="Download Desktop App"
              onClick={(e) => {
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
