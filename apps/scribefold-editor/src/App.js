import React, { useRef } from 'react';
import { useSelector } from 'react-redux';
import './App.css';
import TopBar from './Global/TopBar';
import AppInitializer from './Global/AppInitializer';
import KeypressListeners from './Global/KeypressListeners';
import Editor from './Features/Editors/Editor';
import AiChatBar from './Features/AI/ChatBar/AiChatBar';
import Windows from './Features/Windows/Windows';

/*
  This component will contain: 
    the layout of the application
    the left side with the topbar, page, and editor 
    conditional display components

  settingsObject = from redux 

  return:
  <>
    <container with background (maybe set by settings and an inline css backgroundImage)>
      <page container (fills width when ai chat off, else fills remaining left side area)>
        <TopBar> (or whatever we call it) fills the width of this part of the screen 
        <page semi transparen page centered in left side>
          <Editor>        // Shows one of the editors conditionally
        <page/>
      <page container/>
      <AIChatBar>         // Knows internally if it should show based on redux settingsObject, as with the rest of the components here 
      <Menus/>            // Like settings, right click, save before closing, etc
      <AppInitialiser/>   // Does things like loading app data from supabase auth, our api, etc into redux
    </container>
  </>
  
  the background container is display flex, the page fills the avialbalbe space flex 1 and the ai chat bar shows conditionally
  so the page width changes when the ai chat bar appears because it takes part of hte backgroudn container flex
  and the top bar has 100% width in the page so it does not ever cover the ai chat bar  

*/
export default function App() {

  // This ref will hold the Monaco editor instance once EditorMonaco mounts.
  // We keep it in App so both the editor and the AI chat "Send" button can access it.
  const monacoEditorRef = useRef(null)

  // We are retreiving this so we can display the correct backgroundImageUri
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject)

  return (
    // The background of the entire appliation with the background image
    <div 
      className={"backgroundContainer"}
      // We only use inline style when it makes sense to, like in this case when it is changed by redux global state values
      style={{ backgroundImage: settingsObject?.backgroundImageUri ? `url(${settingsObject.backgroundImageUri})` : undefined }}
    >

      {/* Global key listeners like F11 fullscreen toggle */}
      <KeypressListeners/>

      {/* Contains auth listener and loads initial data like user table data */}
      <AppInitializer/>

      {/* Left side: top bar + centered page */}
      <div className="pageArea">

        {/* The top bar with options like File => Open etc */}
        <TopBar/>
      
        {/* Centers the page area */}
        <div className="pageContainer">

          {/* The page that contains the editor */}
          <div className={"page"}>
          
            {/* The actual editor */}
              <Editor monacoEditorRef={monacoEditorRef}/>
          
          </div>

        </div>

      </div>

      {/* Right side: The AI chat bar that shows conditionally */}
      <AiChatBar monacoEditorRef={monacoEditorRef}/>

      {/* All windows show from here (right click, settings, help etc) */}
      <Windows/>
   
    </div>
  );
}
