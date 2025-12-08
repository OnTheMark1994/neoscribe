import React from 'react';
import Editor from '@monaco-editor/react';
import './MonacoEditorView.css';

/**
 * MonacoEditorView - Monaco editor component for code-style editing
 * 
 * This component provides a Monaco editor interface (VS Code editor).
 * All keyboard shortcuts, save logic, etc. are handled by the parent Editor component.
 */
function MonacoEditorView({ monacoRef, content, onContentChange, placeholder }) {
  const handleEditorDidMount = (editor, monaco) => {
    // Store the editor instance in the ref
    if (monacoRef) {
      monacoRef.current = editor;
    }

    // Set up change listener
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      onContentChange(value);
    });
  };

  return (
    <div className="monaco-editor-container">
      <Editor
        height="100%"
        defaultLanguage="plaintext"
        value={content}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          tabSize: 2,
          insertSpaces: true,
        }}
      />
    </div>
  );
}

export default MonacoEditorView;
