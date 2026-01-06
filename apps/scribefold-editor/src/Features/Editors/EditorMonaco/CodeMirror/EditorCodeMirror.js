/*
        Ok I would like to create a codemirror 6 iplemtation with the following reqirements:
            1: custom folding regions for lines with #chapter and #section at the beginning
                chapters conain sections so when a chapter is folded the sections in it are hidden
                there are icons on the left to fold and unfold the foldabel areas
                this will ideally be done in a built in way in the editor, not manually if possible
                we will also have the aivlity to fold by indent level (also using built in) 

            2: lines store id and ai-share state in metadata
                the ids stay stable and can be used to match lines to suggested modifications (made by an ai llm api)
                the ai-share state displays an icon in the left gutter and when clicked toggles the lines metadata which changes the icon that shows
                if a section is ai-share: hidden all of its content will not be sent to the ai api on send, same with a chapter (including all sections in it) 

            3: ai suggestion diff and accept/reject
                button click will get the lines wiht ids from the editor (leaving some out based on ai share state), send them to 
                this data will come back as an array of suggestoins with line ids
                it will be displayed in a diff view with accept/reject buttons


                any functions that need to be created should be On at worst

                tried with the ai all at once and it was total trash, so having to do it incerementally.

*/

import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import CodeMirror from '@uiw/react-codemirror';
import { buildExtensions } from './EditorCodeMirrorSetup';
import './EditorCodeMirror.css';

export default function EditorCodeMirror({ editorRef }) {
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);

  const handleCreateEditor = useCallback((view) => {
    editorRef.current = view;
  }, [editorRef]);

  const defaultDoc = `#chapter
chapter content
#section
section content
  indented section content
  a
  a
    indented further`;

  const modifiedDoc = `#chapter
chapter content (edited)
#section
section content
  indented section content
  a
    a (changed)
    indented further
#section 2
section content
  NEW extra line here
  indented section content
  a
#section 3
newly added section
  a
  a
    indented further`;

  const extensions = [
    ...buildExtensions(undefined, {
      showLineNumbers: settingsObject?.showMonacoLineNumbers,
    }),
    // unifiedMergeView({
    //   original: defaultDoc,
    //   gutter: true,
    //   mergeControls: true,
    //   allowInlineDiffs: true,
    // }),
  ];

  return (
    <div className="scribefold-codemirror">
      <CodeMirror
        basicSetup={false}
        value={modifiedDoc}
        height="100%"
        width="100%"
        style={{ height: '100%', width: '100%' }}
        extensions={extensions}
        onCreateEditor={handleCreateEditor}
        onChange={() => {}}
      />
    </div>
  );
}