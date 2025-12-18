import React from 'react';
import EditorMonaco from './EditorMonaco/EditorMonaco';
/*
 
 
  */
export default function Editor({ monacoEditorRef }) {
  return (
    <div>
      <EditorMonaco monacoEditorRef={monacoEditorRef}/>
    </div>
  );
}
