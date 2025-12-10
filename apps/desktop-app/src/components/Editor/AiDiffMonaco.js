import React, { useRef } from 'react';
import { useSelector } from 'react-redux';
import { DiffEditor } from '@monaco-editor/react';
import { selectShowMonacoLineNumbers } from '../../store/settingsSlice';
import { selectFlattenedChanges } from '../../store/aiSlice';
import './MonacoEditorView.css';

/**
 * AiDiffMonaco - shows a Monaco diff view for the first available AI proposal.
 * Creates two versions of the text: original and changed per the proposal.
 */
const AiDiffMonaco = () => {
  const showLineNumbers = useSelector(selectShowMonacoLineNumbers);
  const changes = useSelector(selectFlattenedChanges);
  const diffEditorRef = useRef(null);

  if (!changes || changes.length === 0) {
    return (
      <div className="monaco-editor-container" style={{ padding: '12px', color: '#ccc' }}>
        No AI proposals yet. Ask the AI assistant to propose edits to see a diff.
      </div>
    );
  }

  // For now, show the first proposal. This can be extended later to support selection.
  const proposal = changes[0];

  let originalText = proposal.originalText || '';
  let modifiedText = originalText;

  if (proposal.type === 'modify' && proposal.proposedText != null) {
    modifiedText = proposal.proposedText;
  } else if (proposal.type === 'insert' && Array.isArray(proposal.linesToInsert)) {
    // Inserted lines shown as original + new lines
    const insertBlock = proposal.linesToInsert.join('\n');
    modifiedText = originalText ? `${originalText}\n${insertBlock}` : insertBlock;
  } else if (proposal.type === 'delete') {
    // Deletion: modified version is empty or a short note
    modifiedText = '';
  }

  const handleMount = (editor, monaco) => {
    diffEditorRef.current = editor;

    if (!window.__scribefoldDiffThemeRegistered) {
      monaco.editor.defineTheme('scribefold-diff-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#1e1e1e',
          'editorGutter.background': '#1e1e1e',
        },
      });
      window.__scribefoldDiffThemeRegistered = true;
    }

    monaco.editor.setTheme('scribefold-diff-dark');

    const modifiedEditor = editor.getModifiedEditor();
    if (modifiedEditor) {
      modifiedEditor.focus();
    }
  };

  return (
    <div className="monaco-editor-container">
      <DiffEditor
        height="100%"
        language="plaintext"
        original={originalText}
        modified={modifiedText}
        onMount={handleMount}
        theme="scribefold-diff-dark"
        options={{
          lineNumbers: showLineNumbers ? 'on' : 'off',
          minimap: { enabled: false },
          renderSideBySide: true,
          renderMarginRevertIcon: true,
          ignoreTrimWhitespace: false,
          diffWordWrap: 'on',
          originalEditable: false,
          readOnly: false,
          wordWrap: 'on',
          scrollBeyondLastLine: true,
          fontSize: 14,
          lineHeight: 24,
          renderLineHighlight: 'none',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          parameterHints: { enabled: false },
          wordBasedSuggestions: false,
          tabCompletion: 'off',
        }}
      />
    </div>
  );
};

export default AiDiffMonaco;
