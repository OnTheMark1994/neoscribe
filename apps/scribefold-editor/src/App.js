import { useRef } from 'react';
import { useSelector } from 'react-redux';
import './App.css';
import TopBar from './Global/TopBar';
import AppInitializer from './Global/AppInitializer';
import KeypressListeners from './Global/KeypressListeners';
import AiChatBar from './Features/AI/ChatBar/AiChatBar';
import AiChatToggle from './Features/AI/AiChatToggle';
import Windows from './Features/Windows/Windows';
import KeyboardWindow from './Features/Windows/KeyboardWindow';
import ChangeNavigator from './Features/AI/Components/ChangeNavigator';
import Editor from './Features/Editors/CodeMirror/Editor';
import { DEFAULT_COLORS } from './Features/Settings/Tabs/SettingsOptions/constants';
import Tabs from './Features/Editors/CodeMirror/Tabs/Tabs';

export default function App() {

  // Reference to editor instance for cross-component access
  const editorRef = useRef(null)
  // {tabId: content} used to restore content in browser refresh
  const editorContentInstancesRef = useRef({})
  // {tabId: EditorState} used for full restore (fold areas, content, etc) on tab change
  const editorViewInstancesRef = useRef({})
  // Stores original document content for diff comparison
  const originalDocRef = useRef('')
  // Controls whether diff view/change navigator is shown
  const showDiffView = useSelector(state => state.editorSlice.showDiffView);

  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const backgroundImageUri = settingsObject?.backgroundImageUri;
  const customBackgroundImage = settingsObject?.customBackgroundImage;
  const actualBackgroundImage = backgroundImageUri === 'custom' ? customBackgroundImage : backgroundImageUri;
  const textColor = settingsObject?.textColor || DEFAULT_COLORS.textColor;
  const pageBgColor = settingsObject?.pageBgColor || DEFAULT_COLORS.pageBgColor;
  const indentMarkerColor = settingsObject?.indentMarkerColor || DEFAULT_COLORS.indentMarkerColor;
  const indentMarkerColorActive = settingsObject?.indentMarkerColorActive || DEFAULT_COLORS.indentMarkerColorActive;

  return (
    <>
      <style>{`
        body {
          --text-color: ${textColor};
        }
        .page {
          --page-bg-color: ${pageBgColor};
        }
        .cm-indent-markers {
          --indent-marker-active-bg-color: ${indentMarkerColorActive} !important;
          --indent-marker-bg-color: ${indentMarkerColor} !important;
        }
      `}</style>
      {/* The background of the entire appliation with the background image */}
      <div
        className={"backgroundContainer"}
        style={{ backgroundImage: actualBackgroundImage ? `url(${actualBackgroundImage})` : undefined }}
      >

      {/* Global key listener (really just F11 fullscreen toggle) */}
      <KeypressListeners/>

      {/* Auth listener, user data, open last file */}
      <AppInitializer editorRef={editorRef} editorContentInstancesRef={editorContentInstancesRef}/>

      {/* Left side: top bar + centered page */}
      <div className="pageArea">

        {/* The top bar with options like File => Open etc */}
        <TopBar editorRef={editorRef} editorContentInstancesRef={editorContentInstancesRef} editorViewInstancesRef={editorViewInstancesRef}/>
      
        {/* Centers the page area */}
        <div className="pageContainer">

          {/* The page that contains the editor */}
          <div className={"page"}>

            <Tabs editorRef={editorRef} editorContentInstancesRef={editorContentInstancesRef} editorViewInstancesRef={editorViewInstancesRef}/>
          
            {/* The actual editor */}
              <Editor editorRef={editorRef} originalDocRef={originalDocRef}/>
          
          </div>

          {showDiffView && <ChangeNavigator/>}

        </div>

      </div>

      {/* Right side: The AI chat bar that shows conditionally */}
      <AiChatBar editorRef={editorRef} originalDocRef={originalDocRef}/>

      {/* Toggle button that appears when AI chat is hidden */}
      <AiChatToggle/>

      {/* All windows show from here (right click, settings, help etc) */}
      <Windows editorRef={editorRef}/>

      <KeyboardWindow editorRef={editorRef}/>
   
    </div>
    </>
  );
}
