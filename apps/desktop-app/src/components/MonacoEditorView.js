import React, { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import './MonacoEditorView.css';

/**
 * MonacoEditorView - Monaco editor component with custom #chapter/#section folding
 * 
 * This component provides a Monaco editor interface (VS Code editor) with:
 * - Custom folding for #chapter and #section markers
 * - Line numbers (array-like index display)
 * - Syntax highlighting for chapter/section headers
 */
function MonacoEditorView({ monacoRef, content, onContentChange }) {
  const foldingProviderRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    // Store the editor instance in the ref
    if (monacoRef) {
      monacoRef.current = editor;
    }

    // Register custom folding provider for #chapter and #section
    if (!foldingProviderRef.current) {
      foldingProviderRef.current = monaco.languages.registerFoldingRangeProvider('scribefold', {
        provideFoldingRanges: function(model) {
          const lines = model.getLinesContent();
          const ranges = [];
          const stack = []; // Track open sections: { lineNumber, level }

          lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const trimmed = line.trim().toLowerCase();

            // Check for chapter/section start
            if (/^#chapter\b/.test(trimmed)) {
              // Close any open sections of same or higher level
              while (stack.length > 0) {
                const prev = stack.pop();
                ranges.push({
                  start: prev.lineNumber,
                  end: lineNumber - 1,
                  kind: monaco.languages.FoldingRangeKind.Region,
                });
              }
              stack.push({ lineNumber, level: 1 });
            } else if (/^#section\b/.test(trimmed)) {
              // Close any open sections at level 2
              while (stack.length > 0 && stack[stack.length - 1].level >= 2) {
                const prev = stack.pop();
                ranges.push({
                  start: prev.lineNumber,
                  end: lineNumber - 1,
                  kind: monaco.languages.FoldingRangeKind.Region,
                });
              }
              stack.push({ lineNumber, level: 2 });
            } else if (/^#chapterend\b/.test(trimmed)) {
              // Close all sections up to and including the chapter
              while (stack.length > 0) {
                const prev = stack.pop();
                ranges.push({
                  start: prev.lineNumber,
                  end: lineNumber,
                  kind: monaco.languages.FoldingRangeKind.Region,
                });
                if (prev.level === 1) break;
              }
            } else if (/^#sectionend\b/.test(trimmed)) {
              // Close the current section
              if (stack.length > 0 && stack[stack.length - 1].level === 2) {
                const prev = stack.pop();
                ranges.push({
                  start: prev.lineNumber,
                  end: lineNumber,
                  kind: monaco.languages.FoldingRangeKind.Region,
                });
              }
            }
          });

          // Close any remaining open sections at end of file
          while (stack.length > 0) {
            const prev = stack.pop();
            ranges.push({
              start: prev.lineNumber,
              end: model.getLineCount(),
              kind: monaco.languages.FoldingRangeKind.Region,
            });
          }

          return ranges;
        }
      });

      // Register custom language for syntax highlighting
      monaco.languages.register({ id: 'scribefold' });
      
      monaco.languages.setMonarchTokensProvider('scribefold', {
        tokenizer: {
          root: [
            [/^#chapter\b.*/, 'keyword.chapter'],
            [/^#chapterend\b.*/, 'keyword.chapter'],
            [/^#section\b.*/, 'keyword.section'],
            [/^#sectionend\b.*/, 'keyword.section'],
            [/^#summary\b.*/, 'keyword.summary'],
            [/#folded\b/, 'comment.folded'],
            [/#ai-title\b/, 'comment.ai'],
            [/#ai-summary\b/, 'comment.ai'],
            [/#ai-hide\b/, 'comment.ai'],
          ]
        }
      });

      // Define custom theme with chapter/section highlighting
      monaco.editor.defineTheme('scribefold-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword.chapter', foreground: 'FF79C6', fontStyle: 'bold' },
          { token: 'keyword.section', foreground: '8BE9FD', fontStyle: 'bold' },
          { token: 'keyword.summary', foreground: 'BD93F9', fontStyle: 'italic' },
          { token: 'comment.folded', foreground: '6272A4', fontStyle: 'italic' },
          { token: 'comment.ai', foreground: '50FA7B', fontStyle: 'italic' },
        ],
        colors: {}
      });

      // Apply the custom theme
      monaco.editor.setTheme('scribefold-dark');
    }

    // Set up change listener
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      onContentChange(value);
    });
  };

  // Cleanup folding provider on unmount
  useEffect(() => {
    return () => {
      if (foldingProviderRef.current) {
        foldingProviderRef.current.dispose();
        foldingProviderRef.current = null;
      }
    };
  }, []);

  return (
    <div className="monaco-editor-container">
      <Editor
        height="100%"
        defaultLanguage="scribefold"
        value={content}
        theme="scribefold-dark"
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
          folding: true,
          foldingHighlight: true,
          showFoldingControls: 'always',
          glyphMargin: true,
        }}
      />
    </div>
  );
}

export default MonacoEditorView;
