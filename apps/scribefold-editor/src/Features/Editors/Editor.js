import EditorCodeMirror from './CodeMirror/EditorCodeMirror';

/*
  This was used to switch between editors but is now not necessary

*/
export default function Editor({ editorRef, originalDocRef }) {

  return (
    <>
      <EditorCodeMirror editorRef={editorRef} originalDocRef={originalDocRef}></EditorCodeMirror>
    </>
  );
}
