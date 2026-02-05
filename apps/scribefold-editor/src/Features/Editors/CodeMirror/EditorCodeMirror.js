import React, { useCallback, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toggleShowDiffView, setShowDiffView, setModified } from '../../../Global/ReduxSlices/EditorSlice';
import { openRightClickWindow, closeRightClickWindow } from '../../../Global/ReduxSlices/WindowSlice';
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

  // Listen for context menu events from main process
  useEffect(() => {
    const handleContextMenuEvent = (event, params) => {
      console.log('[EditorCodeMirror] Context menu event received from main process');
      console.log('[EditorCodeMirror] Context menu params:', params);
      console.log('[EditorCodeMirror] Context menu params?.dictionarySuggestions:', params?.dictionarySuggestions);

      // Store only the suggestion strings (not functions) in Redux
      const options = params?.dictionarySuggestions || [];
      console.log("options: ", options)

      dispatch(openRightClickWindow({ left: params.x, top: params.y, options }));
    };

    if (window.electronAPI?.onContextMenuEvent) {
      window.electronAPI.onContextMenuEvent(handleContextMenuEvent);
    }

    return () => {
      // Cleanup listener if needed (ipcRenderer.removeListener would need to be exposed)
    };
  }, [dispatch]);

  // Handle context menu to log right-click via IPC
  const handleContextMenu = useCallback(() => {
    console.log("in handleContextMenu")
    if (window.electronAPI?.logRightClick) {
      console.log("EditorCodeMirror.js: window.electronAPI?.logRightClick")
      window.electronAPI.logRightClick();
    }else{
      console.log("EditorCodeMirror.js: No window.electronAPI?.logRightClick")
    }
  }, []);

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