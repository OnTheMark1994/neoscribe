import React, { useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleShowDiffView, setShowDiffView, setModified } from '../../../Global/ReduxSlices/EditorSlice';
import { openRightClickWindow } from '../../../Global/ReduxSlices/WindowSlice';
import CodeMirror from '@uiw/react-codemirror';
import { getOriginalDoc, unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { buildExtensions } from './EditorCodeMirrorSetup';
import './EditorCodeMirror.css';
import './EditorCodeMirrorSearch.css';
import MinimalSearchBar from './MinimalSearchBar';

export default function EditorCodeMirror({ editorRef, originalDocRef }) {
  const dispatch = useDispatch();
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const showDiffView = useSelector(state => state.editorSlice.showDiffView);

  // Handle context menu to show right-click window
  const handleContextMenu = useCallback((event) => {
    event.preventDefault();
    dispatch(openRightClickWindow({
      left: event.clientX,
      top: event.clientY,
      type: 'context'
    }));
  }, [dispatch]);

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
 
  const extensions = [
    ...buildExtensions(
      ()=>{dispatch(setModified(true))}, 
      settingsObject?.aiModeActive,
      {
        showLineNumbers: settingsObject?.showMonacoLineNumbers,
        spellcheckEnabled: settingsObject?.spellcheckEnabled,
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
    <div className="scribefold-codemirror" onContextMenu={handleContextMenu}>
      <MinimalSearchBar editorRef={editorRef} visible={true}></MinimalSearchBar>
      <CodeMirror
        basicSetup={false}
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