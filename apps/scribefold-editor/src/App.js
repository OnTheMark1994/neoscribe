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
import EditorCodeMirror from './Features/Editors/CodeMirror/Editor';
import Editor from './Features/Editors/CodeMirror/Editor';

export default function App() {

  // Reference to editor instance for cross-component access
  const editorRef = useRef(null)
  // Stores original document content for diff comparison
  const originalDocRef = useRef('')
  // Controls whether diff view/change navigator is shown
  const showDiffView = useSelector(state => state.editorSlice.showDiffView);

  // We are retreiving this so we can display the correct backgroundImageUri
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject)

  return (
    // The background of the entire appliation with the background image
    <div 
      className={"backgroundContainer"}
      // We only use inline style when it makes sense to, like in this case when it is changed by redux global state values
      style={{ backgroundImage: settingsObject?.backgroundImageUri ? `url(${settingsObject.backgroundImageUri})` : undefined }}
    >

      {/* Global key listener (really just F11 fullscreen toggle) */}
      <KeypressListeners/>

      {/* Auth listener, user data, open last file */}
      <AppInitializer editorRef={editorRef}/>

      {/* Left side: top bar + centered page */}
      <div className="pageArea">

        {/* The top bar with options like File => Open etc */}
        <TopBar editorRef={editorRef}/>
      
        {/* Centers the page area */}
        <div className="pageContainer">

          {/* The page that contains the editor */}
          <div className={"page"}>
          
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
  );
}
