/*
  This shows if the user tries to close the application or open a new file when they still have unsaved changes
  
  There are options to disgard and continue, 
  cancel (just stops the open or close action), 
  save (calls save or save as depending on if there is an existing file)
 
*/
import React from 'react';
import { useSelector } from 'react-redux';
import Window from '../Util/Window';

export default function SaveBeforeClosingWindow() {

  const showWindow = useSelector(state => state.windowSlice.showSaveBeforeClosingWindow)

  // Cancels the leave application or file action that was going to happen
  function cancel(){

  }
  
  // Saves and proceeds with action
  function saveAndProceed(){

  }

  // Disgards changes (just don't save) and proceeds with the action (like close or open new file etc)
  function disgardAndProceed(){

  }

  return (
    <Window
      title="Unsaved Changes!"
      onClose={cancel}
      open={showWindow}
    >
      
    </Window>
  );
}
