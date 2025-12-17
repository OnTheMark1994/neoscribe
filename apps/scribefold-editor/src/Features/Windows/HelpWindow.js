import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Window from '../Util/Window';
import FoldableSection from '../Util/FoldableSection';
import { setShowHelpWindow } from '../../Global/ReduxSlices/WindowSlice';
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
          {/* section jsx */}
        </>
      )
    },
    // ...

  ]
  

  return (
    // Window that contains the window
    <Window
      title="Help"
      onClose={()=>dispatch(setShowHelpWindow())}
      open={showWindow}
    >
      {/* The help window sections mapped from the array of objects defined above */}
      {helpSections.map(sectionJson => 
        <FoldableSection
          title={sectionJson.title}
          // Causes the 
          defaultOpen={initialSection === sectionJson.id}
          scrollTo={initialSection === sectionJson.id}
        >
          {/* The section content in JSX */}
          {sectionJson.content}
        </FoldableSection>

      )}
    </Window>
  );
}
