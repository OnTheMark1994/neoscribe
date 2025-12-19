import React from 'react';
import EditorMonaco from './EditorMonaco/EditorMonaco';
/*
  EditorMonaco seems just as performat as EdtiroMonacoFoldOptamized so I'll just leave it
 
*/
export default function Editor({ monacoEditorRef }) {
  return (
    <div>
      <EditorMonaco monacoEditorRef={monacoEditorRef}/>
    </div>
  );
}
