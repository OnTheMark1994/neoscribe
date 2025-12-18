import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Window from '../Util/Window';
import FoldableSection from '../Util/FoldableSection';
import { setShowHelpWindow } from '../../Global/ReduxSlices/WindowSlice';
import './HelpMenu.css';
import './HelpWindow.css';
 /*
  This page contains a window that has help information for the user

  showHelpWindow = redux useSelctro windowSlice.showHelpWindow 
  
  if !showHelpWindow return

  <Window
    title={"Help Window"}
    onClose={dispatch(close help window action)}
  >

    some basic info stuff
    "Open sections to view info on that subject"

    <FoldableArea
      title={"Help section one about xyz"}
    >
      info about that section
    <FoldableArea/>
    ...other foldable areas
    
  <Window/>

 */
export default function HelpWindow() {

  // Display component conditionally based on state.windowSlice.showHelpWindow
  const showWindow = useSelector(state => state.windowSlice.showHelpWindow)

  // Causes the selected section to default to be scrolled to and default open using useEffect in the  FoldableArea
  const initialSection = useSelector(state => state.windowSlice.helpWindowInitialSection)

  const dispatch = useDispatch()

  // The url of the video that will show at the top 
  const helpVideoUrl = ""

  // The sections are defined here
  const helpSections = [
    {
      id: "ai-help",
      title: "AI Help",
      content: (
        <>
          <div className="helpMenuSectionText">
            <p>
              The AI Chat bar can be toggled from the TopBar under the AI menu.
              In developer mode, the <strong>+</strong> button on assistant messages opens a message detail window.
            </p>
            <p>
              Tips:
              <br />
              - Keep prompts specific
              <br />
              - Break large edits into smaller requests
              <br />
              - Use the token estimate row to avoid oversized prompts
            </p>
          </div>
        </>
      )
    },
    {
      id: "token-usage",
      title: "Token Usage FAQ",
      content: (
        <div className="helpMenuSectionText">
          <p>
            Tokens are used when sending prompts to the AI service.
            Your available tokens and estimated usage per prompt are shown in the AI Chat sidebar.
          </p>
          <p>
            If you run out of tokens, you may need to create an account or refresh token info.
          </p>
        </div>
      )
    },
    {
      id: "shortcuts",
      title: "Keyboard Shortcuts",
      content: (
        <div className="helpMenuSectionText">
          <p>
            Common shortcuts:
            <br />
            - Save: Ctrl+S
            <br />
            - Open: Ctrl+O
            <br />
            - New: Ctrl+N
            <br />
            - Full Screen: F11
          </p>
        </div>
      )
    },

  ]
  

  return (
    // Window that contains the window
    <Window
      title="Help"
      onClose={()=>dispatch(setShowHelpWindow())}
      open={showWindow}
      className="helpWindow"
    >
      <div className="helpMenu">
        <div className="helpMenuTop">
          <div className="helpMenuTitle">Help</div>
          <div className="helpMenuSubtitle">Open a section to view info on that subject.</div>
        </div>

        {/* The help window sections mapped from the array of objects defined above */}
        {helpSections.map(sectionJson => (
          <FoldableSection
            key={sectionJson.id}
            title={sectionJson.title}
            defaultOpen={initialSection === sectionJson.id}
            scrollTo={initialSection === sectionJson.id}
          >
            {sectionJson.content}
          </FoldableSection>
        ))}
      </div>
    </Window>
  );
}
