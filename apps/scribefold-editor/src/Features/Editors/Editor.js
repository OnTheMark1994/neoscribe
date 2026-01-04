import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import EditorMonaco from './EditorMonaco/EditorMonaco';
/*
  EditorMonaco seems just as performat as EdtiroMonacoFoldOptamized so I'll just leave it
 
*/
export default function Editor({ monacoEditorRef }) {

  // Getting the proposed changes from redux (they come from the ai chat) 
  const proposedChanges = useSelector(state => state.aiSlice.proposedChanges);

  // Just logging prposed changes for now
  useEffect(() => {
    console.log('[EditorMonaco] proposedChanges updated:', proposedChanges);
  }, [proposedChanges]);

  // Todo: display an editor type based on proposed changes

  return (
    <>
      <EditorMonaco monacoEditorRef={monacoEditorRef}/>
    </>
  );
}
