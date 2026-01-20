import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import EditorMonaco from './EditorMonaco/EditorMonaco';
import EditorMonacoDiff from './EditorMonaco/EditorMonacoDiff';
import EditorMonacoDiff2 from './EditorMonaco/EditorMonacoDiff2';
import EditorCodeMirror from './EditorMonaco/CodeMirror/EditorCodeMirror';
import ChangeNavigator from '../AI/Components/ChangeNavigator';
/*
  EditorMonaco seems just as performat as EdtiroMonacoFoldOptamized so I'll just leave it
 
  proposed changes flow

  1: in editor, new proposed changes come in
  2: in diff editor, more proposed changes come in
  3: accept/reject of one or all lines
      one line accpeted
        proposed change is put into the original
      one line rejected
      all accepted
      all rejected
  4: in diff editor all changes accepted or rejected (proposed changes array goes to 0 length)

  1: New Changes
    propsedChanges array changes (and is non 0 length)
      Editor.js useEffect called
        it sees its in normal mode
        pulls the data from editor, puts it in var
        calculates new value
        puts new and current in refs
        sets state so diff editor shows
        those refs hydrate initial value of diff editor
  2: Added Change
      note: we want to make sure to pull from the editor when adding the proposed changes in case the user modified the content lines while the ai was thinking  
      propsedChanges array changes (and is non 0 length)
        Editor.js useEffect called
          it sees its already in editor mode
          pulls modified from diff editor
          calculates new value based on that
          sets new value with the ref
    
  3: Accept / Reject
      where are these changes going to take place? 
        need to change the original, modified, and the proposed changes array
        
        Accept 1:
          accept button is clicked 
          id is used to:
            update the original to contain that version   
            change the proposed changes array

    instead of all this we could insert components that show the proposed change

  4: Out of diff mode
      propsedChanges array changes (0 length)
        Editor.js useEffect called
          sees the 0 length
          sees that it is in diff mode 
          pulls the original from diff editor
          puts it in a ref
          sets state to switch to normal editor
            the ref hydrates it on mount


  do we want to show the accept reject button on each changed line?
  what if the user adds 10 lines while its in editor mode? do they need to click accpet on all of their own changes
  what if there are no more proposed changes in the array but the user modified the content a lot while it was in editor mode

  maybe when new proposed changes come in we 
  pull current or (modified if in diff)
  make changes to that 
  set that as the modified
  don't store that array of changes
  just show the accept/reject based on the diff between original and modified
  one accept/reject at the end of the number of new lines


  need to see how we are curently adding ids before the ai chat call 
  and how those are put into the editor ines for persistance
  we will need to pull all of that data if we are going to switch editors

  maybe always show diff editor
  when not in modify mode it edits original and keeps modified in sync or empty so there are not diffs shown
  when in modify mode it changes the modified
  when all modifications are gone (checked in the function that processes to show the buttons)
  it says switch to non diff mode (still diff editor but onChange affects the original)

  or maybe user edits always change the og, only the ai changes are shown as diff
  when in normal mode on every keypress we will set modified editor value to the value in original 
  when in modify mode it will updae the modified editor content 
  when checking to see if there are any diffs buttons to show and there are none then it switches modes. 
  grok chat with some code



  we also want to add the prposed chanevs navigator like the last one
  it can maybe do a document.getelement to search by id for the corressponding one and that one will be scrolled to
  idk if code like a useEffect can be put in the accept reject button boxes


  should we have the mode state and other thigns related to this in the Editor.js
  and the diff navigator maybe

add a check somehwere to prevent this error:
  ERROR
Illegal value for lineNumber

Error: Illegal value for lineNumber
    at sl.getLineMaxColumn (https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:248:144)
    at dN.getBottomForLineNumber (https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:257:2255)
    at https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:390:22735
    at Dt (https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:7:111626)
    at twe.render (https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:390:22076)
    at xv._runFn (https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:390:21576)
    at xv._run (https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:8:6289)
    at xv.endUpdate (https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:8:6829)
    at Hm.finish (https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:7:112437)
    at Dt (https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs/editor.api-CalNCsUg.js:7:111641)
Error: Illegal value for lineNumber




monaco-editor modified-in-monaco-diff-editor no-user-select  showUnused showDeprecated vs-dark
class="monaco-editor modified-in-monaco-diff-editor no-user-select  showUnused showDeprecated vs-dark"
*/
export default function Editor({ editorRef, originalDocRef }) {

  // Getting the proposed changes from redux (they come from the ai chat) 
  const showDiffView = useSelector(state => state.editorSlice.showDiffView);

  // Maybe we keep a ref up to date with the monaco editor values (current) and use that to set the values


  // Todo: display an editor type based on proposed changes

  return (
    <>
      <EditorCodeMirror editorRef={editorRef} originalDocRef={originalDocRef}></EditorCodeMirror>
      {/* {showDiffView && <ChangeNavigator/>} */}
    </>
  );
}
