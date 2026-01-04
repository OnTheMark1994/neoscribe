import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import EditorMonaco from './EditorMonaco/EditorMonaco';
import EditorMonacoDiff from './EditorMonaco/EditorMonacoDiff';
/*
  EditorMonaco seems just as performat as EdtiroMonacoFoldOptamized so I'll just leave it
 
  proposed hanges flow

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

*/
export default function Editor({ monacoEditorRef }) {

  // Getting the proposed changes from redux (they come from the ai chat) 
  const proposedChanges = useSelector(state => state.aiSlice.proposedChanges);

  // Maybe we keep a ref up to date with the monaco editor values (current) and use that to set the values

  // Just logging prposed changes for now
  useEffect(() => {
    // If there are proposed changes
    if(proposedChanges && proposedChanges.length > 0){
      // Show the diff editor, set its values (after its showging somehow)
    }else{
      // Show just the editor? 
    }
    console.log('[EditorMonaco] proposedChanges updated:', proposedChanges);
    const currentVersion = ""// get from editor or diffeditor modified
    const withProposedChanges = buildProposedChangesVersion(currentVersion, proposedChanges)
  }, [proposedChanges]);

  // Takes the current version from editor or diffeditor modified and the proposed changes array, uses line ids to create a new modified version
  function buildProposedChangesVersion(currentVersion, proposedChanges){

  }

  // Todo: display an editor type based on proposed changes

  return (
    <>
      {/* <EditorMonaco monacoEditorRef={monacoEditorRef}/> */}
      <EditorMonacoDiff monacoEditorRef={monacoEditorRef}/>
    </>
  );
}
