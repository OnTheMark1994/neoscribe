import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  selectShowMonacoLineNumbers,
} from '../../store/settingsSlice';
import { DiffEditor } from '@monaco-editor/react';
import './MonacoEditorView.css';

/**
 * DiffMonaco - Monaco diff editor showing original vs modified content
 * Displays side-by-side comparison with built-in diff highlighting
 */
const DiffMonaco = () => {
  const showLineNumbers = useSelector(selectShowMonacoLineNumbers);
  const diffEditorRef = useRef(null);
  const monacoRef = useRef(null);

  // Sample original content (10 lines)
  const originalContent = `function calculateTotal(items) {
  let sum = 0;
  for (let i = 0; i < items.length; i++) {
    sum += items[i].price;
  }
  return sum;
}

const items = [{ price: 10 }, { price: 20 }];
console.log(calculateTotal(items));`;

  // Sample modified content (12 lines: 2 new lines, 2 changed lines)
  const modifiedContent = `function calculateTotal(items, tax = 0) {
  if (!items || items.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < items.length; i++) {
    sum += items[i].price;
  }
  const total = sum * (1 + tax);
  return total;
}

const items = [{ price: 10 }, { price: 20 }];
console.log(calculateTotal(items, 0.08));`;

  const handleMount = (editor, monaco) => {
    diffEditorRef.current = editor;
    monacoRef.current = monaco;

    // Apply custom theme if not already defined
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

    // Focus the modified editor
    const modifiedEditor = editor.getModifiedEditor();
    if (modifiedEditor) {
      modifiedEditor.focus();
    }
  };

  return (
    <div className="monaco-editor-container">
      <DiffEditor
        height="100%"
        language="javascript"
        original={originalContent}
        modified={modifiedContent}
        onMount={handleMount}
        theme="scribefold-diff-dark"
        options={{
          // Layout / appearance
          lineNumbers: showLineNumbers ? 'on' : 'off',
          minimap: { enabled: false },
          
          // Diff-specific options
          renderSideBySide: true,
          renderMarginRevertIcon: true,
          ignoreTrimWhitespace: false,
          diffWordWrap: 'on',
          
          // Make original read-only, modified editable
          originalEditable: false,
          readOnly: false,
          
          // General editor feel
          wordWrap: 'on',
          scrollBeyondLastLine: true,
          fontSize: 14,
          lineHeight: 24,
          renderLineHighlight: 'none',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          
          // Disable suggestions
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

export default DiffMonaco;
