import { useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setShowDiffView, setModified } from '../../../Global/ReduxSlices/EditorSlice';
import { openRightClickWindow } from '../../../Global/ReduxSlices/WindowSlice';
import CodeMirror from '@uiw/react-codemirror';
import { getOriginalDoc, unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { buildExtensions } from './EditorSetup';
import './Editor.css';
import './EditorSearch.css';
import MinimalSearchBar from './MinimalSearchBar';

export default function Editor({ editorRef, originalDocRef }) {
  const dispatch = useDispatch();
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const showDiffView = useSelector(state => state.editorSlice.showDiffView);
  
  // Listen for context menu events from main process
  useEffect(() => {
    const handleContextMenuEvent = (event, params) => {

      // We can see if it was a eye icon that was right clicked on here
      if (params?.srcURL) {
        if (params.srcURL.includes('scribefold-ai-eye')) {
          // we can log the params and use some of them to decide tho show different right click menu options if we want to
        }
      }



      // Store only the suggestion strings (not functions) in Redux
      const options = params?.dictionarySuggestions || [];

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
    if (window.electronAPI?.logRightClick) {
      window.electronAPI.logRightClick();
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
        spellcheckEnabled: settingsObject?.spellcheckEnabled,
        lineWrapEnabled: settingsObject?.lineWrapEnabled,
        indentMarkersEnabled: settingsObject?.indentMarkersEnabled,
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
      <style>{`
        body {
          --text-color: ${settingsObject?.textColor};
        }
        .page {
          --page-bg-color: ${settingsObject?.pageBgColor};
        }
        .cm-indent-markers {
          --indent-marker-active-bg-color: ${settingsObject?.indentMarkerBgColor} !important;
          --indent-marker-bg-color: ${settingsObject?.indentMarkerColor} !important;
        }
      `}</style>
      <MinimalSearchBar editorRef={editorRef}></MinimalSearchBar>
      <CodeMirror
        basicSetup={false}
        extensions={extensions}
        onCreateEditor={handleCreateEditor}
      />
    </div>
  );
}