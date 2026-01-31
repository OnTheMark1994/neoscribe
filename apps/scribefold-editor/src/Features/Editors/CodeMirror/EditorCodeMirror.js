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



                  ok I have the data being sent to the api, ai is responding with proposed changes based on line ids. the user can change the content while its thinking. so it might be in normal mode while thinking or already in diff mode (with the CodeMirror unifiedMergeView) so we will maybe want to pull the original if its not in edit mode already or the modified if its in unifiedMergeView mode and the user is editing the modified version or there are already modifications, and add the propoed chnage to the lines of that, and then set the modified version to that.



                  for example



                  in normal mode

                  user says "add some stuff and modify some stuff" with the array of lines and ids

                  user modifies some random lines

                  the ai responds, it pulls the current editor text, adds or modifies lines based on id, switches to diff mode, sets the modified of the editor to that new modified value

                  user makes some changes to that 

                  the user accepts or rejects a few but not all of the prposed changes 

                  while still in diff user prompts ai

                  says modify some more stuff

                  they press send and the modified version not origianl goes to the ai

                  they modify some more stuff

                  the ai responds and pulls the modified version and makes some change to that then sets that to thenew mofieid in the editor

                  then the user accepts or rejects the individual cahnges

                  somehow it is known when they are all accepted and rejected and it goes back into normal mode where modifications are not shown in green or red but just all normal text (until they get more proposed changes)

                  what is the best way to implement this?    

                  we will probably have a helper function that takes the editor ref, in that it will know which mode the editor is in and pull the correct data accordingly, then add the propsed changes based on the id, and then set it into the propse place using the ref. 
                  so showProposedChanges(editorRef, proposedChangesArray) or something like this 

                  lets start with the showProposedChanges function
                  we want to pull the data from the correct place (the content or the modived content if its already in diff mode)
                  make the modifications in an efficient way (add remove or modify lines based on id)
                    the response format is in constants.js in apps/scribefold-api 
                  log the new version 
                  make it show the diff mode if not already in diff mode (and ther are changes)
                  set the modified to this
                

              Test Prompt:
              Please make modifications, additions, and removals of lines at places of your choosing

              please mod the file per the ( comments 

*/

import React, { useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleShowDiffView, setShowDiffView, setModified } from '../../../Global/ReduxSlices/EditorSlice';
import CodeMirror from '@uiw/react-codemirror';
import { getOriginalDoc, unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { buildExtensions } from './EditorCodeMirrorSetup';
import './EditorCodeMirror.css';

export default function EditorCodeMirror({ editorRef, originalDocRef }) {
  const dispatch = useDispatch();
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const showDiffView = useSelector(state => state.editorSlice.showDiffView);

  // Listener to detect accept/reject actions in the merge view and exit diff mode
  const acceptRevertListener = EditorView.updateListener.of((update) => {
    if (!update.transactions || update.transactions.length === 0) return;

    const hasAcceptOrRevert = update.transactions.some(tr =>
      tr.isUserEvent('accept') || tr.isUserEvent('revert')
    );

    if (!hasAcceptOrRevert) return;

    const currentContent = update.state.doc.toString();
    const originalArray = getOriginalDoc(update.state)
    const original = originalArray.toString();

    if (currentContent === original) {
      dispatch(setShowDiffView(false));
    }
  });

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

  const modifiedDoc = `#chapter abc
#section
hello
    hello (mod this one)
    now hidden
    hello (add to this)
        hello
        #chapter (inserta section after this) 
        #section 
        hidden content  (mod this one)
#chapter abc
#section
hello
    hello
  ac;laja;idj (delete this line)
    now hidden
    hello
        hello
        #chapter (mod this one)
        #section 
        hidden content  (mod this one)
#chapter abc
#section
hello
    hello (mod this one)
    now hidden
    hello (add to this)
        hello
        #chapter (inserta section after this) 
        #section 
        hidden content  (mod this one)
#chapter abc
#section
hello
    hello
  ac;laja;idj (delete this line)
    now hidden
    hello
        hello
        #chapter (mod this one)
        #section 
        hidden content  (mod this one)
`;
 
  const extensions = [
    ...buildExtensions(
      ()=>{dispatch(setModified(true))}, 
      settingsObject?.aiModeActive,
      {
        showLineNumbers: settingsObject?.showMonacoLineNumbers,
      }
    ),
    acceptRevertListener,
    ...(showDiffView ? [
      unifiedMergeView({
        original: originalDocRef.current,
        gutter: true,
        mergeControls: true,
        allowInlineDiffs: true,
      }),
    ] : []),
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