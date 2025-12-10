import React, { useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';
import { selectShowPreviewBar, selectShowMonacoLineNumbers, selectMonacoStickyTopBar } from '../../store/settingsSlice';
import './MonacoNew.css';

/**
 * MonacoNew - Simplified Monaco editor with custom #chapter/#section folding
 * Simple and performant - just displays content and lets user type
 * No content change callbacks - parent manages state
 */
function MonacoNew({ content, onChange }) {
  const monacoRef = useRef(null);
  const foldingProviderRef = useRef(null);
  
  // Read settings from Redux
  const showPreviewBar = useSelector(selectShowPreviewBar);
  const showLineNumbers = useSelector(selectShowMonacoLineNumbers);
  const monacoStickyTopBar = useSelector(selectMonacoStickyTopBar);

  const handleEditorDidMount = (editor, monaco) => {
    monacoRef.current = editor;

    // Register custom folding provider for #chapter and #section
    if (!foldingProviderRef.current) {
      foldingProviderRef.current = monaco.languages.registerFoldingRangeProvider('scribefold', {
        provideFoldingRanges: function(model) {
          const lines = model.getLinesContent();
          const ranges = [];
          const stack = [];

          lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const trimmed = line.trim().toLowerCase();

            if (/^#chapter\b/.test(trimmed)) {
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

      // Register custom language
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
          ]
        }
      });

      // Define custom theme
      monaco.editor.defineTheme('scribefold-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword.chapter', foreground: '000000', fontStyle: 'bold' },
          { token: 'keyword.section', foreground: '000000', fontStyle: 'bold' },
          { token: 'keyword.summary', foreground: '000000', fontStyle: 'italic' },
          { token: 'comment.folded', foreground: '6272A4', fontStyle: 'italic' },
        ],
        colors: {
          'editor.background': '#00000000',
          'editorGutter.background': '#00000000',
          'editor.lineHighlightBackground': '#00000000',
          'editor.lineHighlightBorder': '#00000000',
          'editor.wordHighlightBackground': '#00000000',
          'editor.wordHighlightStrongBackground': '#00000000',
          'editor.selectionHighlightBackground': '#00000000',
        }
      });

      monaco.editor.setTheme('scribefold-dark');
    }

    // Enable indent guides
    editor.updateOptions({
      renderIndentGuides: true,
      guides: {
        indentation: true,
        highlightActiveIndentation: true,
      },
      selectionHighlight: false,
      occurrencesHighlight: false,
    });

    // Set up change listener - just call onChange without passing value
    // Parent can get value from monacoRef if needed
    // if (onChange) {
    //   editor.onDidChangeModelContent(() => {
    //     onChange();
    //   });
    // }
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
        // defaultLanguage="scribefold"
        value={content}
        // theme="scribefold-dark"
        // onMount={handleEditorDidMount}
        // options={{
        //   minimap: { enabled: showPreviewBar },
        //   fontSize: 14,
        //   lineNumbers: showLineNumbers ? 'on' : 'off',
        //   stickyScroll: { enabled: monacoStickyTopBar },
        //   wordWrap: 'on',
        //   automaticLayout: true,
        //   scrollBeyondLastLine: false,
        //   renderWhitespace: 'selection',
        //   tabSize: 2,
        //   insertSpaces: true,
        //   folding: true,
        //   foldingHighlight: true,
        //   showFoldingControls: 'always',
        //   glyphMargin: false,
        //   quickSuggestions: false,
        //   suggestOnTriggerCharacters: false,
        //   wordBasedSuggestions: 'off',
        //   parameterHints: { enabled: false },
        //   acceptSuggestionOnEnter: 'off',
        //   tabCompletion: 'off',
        //   inlineSuggest: { enabled: false },
        //   lightbulb: { enabled: false },
        //   snippetSuggestions: 'none',
        // }}
      />
    </div>
  );
}

export default MonacoNew;