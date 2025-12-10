import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';
import { selectShowPreviewBar, selectShowMonacoLineNumbers, selectMonacoStickyTopBar, selectIsAIEnabled } from '../store/settingsSlice';
import './MonacoEditorView.css';

/**
 * MonacoEditorView - Monaco editor component with custom #chapter/#section folding
 * (refactored per v2 plan)
 * 
 * This component provides a Monaco editor interface (VS Code editor) with:
 * - Custom folding for #chapter and #section markers
 * - Line numbers (array-like index display)
 * - Syntax highlighting for chapter/section headers
 * - AI eye icons for lines shared with AI
 * 
 * Now reads showPreviewBar, showLineNumbers, and isAIEnabled from Redux.
 */
function MonacoEditorView({ monacoRef, content, onContentChange }) {
  const foldingProviderRef = useRef(null);
  const decorationsRef = useRef([]);
  const decorationsTimeoutRef = useRef(null);
  
  // Read from Redux instead of localStorage
  const showPreviewBar = useSelector(selectShowPreviewBar);
  const showLineNumbers = useSelector(selectShowMonacoLineNumbers);
  const monacoStickyTopBar = useSelector(selectMonacoStickyTopBar);
  const isAIEnabled = useSelector(selectIsAIEnabled);

  // Update decorations when content changes
  // NOTE: We no longer fake indentation via CSS; we rely on Monaco's indent guides
  const updateDecorations = (editor, monaco) => {
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    const lines = model.getLinesContent();
    const newDecorations = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmed = line.trim().toLowerCase();
      const hasAiHide = /#ai-hide\b/i.test(line);
      const hasAiTag = /#ai-title\b|#ai-summary\b/i.test(line);

      // Chapter lines - eye icon + chapter decoration (only when AI is enabled)
      if (/^#chapter\b/.test(trimmed)) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'chapter-line-decoration',
            glyphMarginClassName: isAIEnabled ? (hasAiHide ? 'ai-hide-icon' : 'ai-eye-icon') : undefined,
            glyphMarginHoverMessage: isAIEnabled
              ? { value: hasAiHide ? 'Hidden from AI' : 'Shared with AI (click to toggle)' }
              : undefined,
          }
        });
      }
      // Section lines - eye icon + section decoration (only when AI is enabled)
      else if (/^#section\b/.test(trimmed)) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'section-line-decoration',
            glyphMarginClassName: isAIEnabled ? (hasAiHide ? 'ai-hide-icon' : 'ai-eye-icon') : undefined,
            glyphMarginHoverMessage: isAIEnabled
              ? { value: hasAiHide ? 'Hidden from AI' : 'Shared with AI (click to toggle)' }
              : undefined,
          }
        });
      }
      // Lines with AI tags - just eye icon (only when AI is enabled)
      else if (isAIEnabled && (hasAiTag || hasAiHide)) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            glyphMarginClassName: hasAiHide ? 'ai-hide-icon' : 'ai-eye-icon',
            glyphMarginHoverMessage: { value: hasAiHide ? 'Hidden from AI' : 'Shared with AI' }
          }
        });
      }
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  };

  // Re-apply decorations when AI enabled state changes so eyes show/hide correctly
  useEffect(() => {
    const editor = monacoRef?.current;
    if (!editor || !window.monaco) return;
    updateDecorations(editor, window.monaco);
  }, [isAIEnabled]);

  const handleEditorDidMount = (editor, monaco) => {
    // Store instance for parent to call methods if needed
    if (monacoRef) {
      monacoRef.current = editor;
    }

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
            [/#ai-title\b/, 'comment.ai'],
            [/#ai-summary\b/, 'comment.ai'],
            [/#ai-hide\b/, 'comment.ai'],
          ]
        }
      });

      // Define custom theme with transparent background and neutral chapter/section styling
      monaco.editor.defineTheme('scribefold-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          // Chapter and section: bold, neutral color (actual size handled via CSS decorations)
          { token: 'keyword.chapter', foreground: '000000', fontStyle: 'bold' },
          { token: 'keyword.section', foreground: '000000', fontStyle: 'bold' },
          { token: 'keyword.summary', foreground: '000000', fontStyle: 'italic' },
          { token: 'comment.folded', foreground: '6272A4', fontStyle: 'italic' },
          { token: 'comment.ai', foreground: '6272A4', fontStyle: 'italic' },
        ],
        colors: {
          'editor.background': '#00000000',
          'editorGutter.background': '#00000000',
          // Remove focused line and occurrence highlight boxes
          'editor.lineHighlightBackground': '#00000000',
          'editor.lineHighlightBorder': '#00000000',
          'editor.wordHighlightBackground': '#00000000',
          'editor.wordHighlightStrongBackground': '#00000000',
          'editor.selectionHighlightBackground': '#00000000',
        }
      });

      monaco.editor.setTheme('scribefold-dark');
    }

    // Enable indent guides for visual nesting (without modifying text)
    editor.updateOptions({
      renderIndentGuides: true,
      guides: {
        indentation: true,
        highlightActiveIndentation: true,
      },
      // Turn off occurrences/selection highlight boxes
      selectionHighlight: false,
      occurrencesHighlight: false,
    });

    // Inject runtime CSS so Monaco glyph margin eyes use the same PNG icons
    // as the rest of the app without going through the module bundler.
    if (typeof document !== 'undefined' && !document.getElementById('monaco-ai-eye-style')) {
      const style = document.createElement('style');
      style.id = 'monaco-ai-eye-style';
      style.textContent = `
        .monaco-editor .ai-eye-icon {
          background: url('/app-images/scribefold-ai-eye.png') center center no-repeat !important;
          background-size: 14px 14px !important;
          cursor: pointer !important;
        }
        .monaco-editor .ai-hide-icon {
          background: url('/app-images/scribefold-ai-eye-grey.png') center center no-repeat !important;
          background-size: 14px 14px !important;
          cursor: pointer !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Helper to toggle #ai-hide on a line
    const toggleAiHideForLine = (lineNumber) => {
      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(lineNumber);
      const hasAiHide = /#ai-hide\b/i.test(lineContent);
      let newContent;

      if (hasAiHide) {
        // Remove #ai-hide
        newContent = lineContent.replace(/\s*#ai-hide\b/gi, '');
      } else {
        // Add #ai-hide
        newContent = lineContent.trimEnd() + ' #ai-hide';
      }

      editor.executeEdits('ai-toggle', [{
        range: new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1),
        text: newContent
      }]);

      updateDecorations(editor, monaco);
    };

    // Set up change listener - debounce expensive operations
    editor.onDidChangeModelContent(() => {
      // Notify parent that content changed (for modified flag)
      // Don't pass full value on every keystroke - parent can get it from monacoRef when needed
      onContentChange(null);
      
      // Debounce decorations update - no need to run on every keystroke
      if (decorationsTimeoutRef.current) {
        clearTimeout(decorationsTimeoutRef.current);
      }
      decorationsTimeoutRef.current = setTimeout(() => {
        updateDecorations(editor, monaco);
      }, 800);
    });

    // Toggle AI visibility when clicking in the glyph margin on chapter/section lines
    editor.onMouseDown((e) => {
      // Only respond to glyph margin clicks (where our eye icons live)
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        return;
      }

      // If AI is disabled globally, do nothing
      if (!isAIEnabled) {
        return;
      }

      const lineNumber = e.target.position?.lineNumber;
      if (!lineNumber) return;

      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(lineNumber);
      const trimmed = lineContent.trim().toLowerCase();

      // Only respond on chapter/section header lines where we actually place AI eyes
      if (/^#chapter\b/.test(trimmed) || /^#section\b/.test(trimmed)) {
        toggleAiHideForLine(lineNumber);
      }
    });

    // Initial decorations
    updateDecorations(editor, monaco);
  };

  // Cleanup folding provider and debounce timer on unmount
  useEffect(() => {
    return () => {
      if (foldingProviderRef.current) {
        foldingProviderRef.current.dispose();
        foldingProviderRef.current = null;
      }
      if (decorationsTimeoutRef.current) {
        clearTimeout(decorationsTimeoutRef.current);
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
          minimap: { enabled: showPreviewBar },
          fontSize: 14,
          lineNumbers: showLineNumbers ? 'on' : 'off',
          stickyScroll: { enabled: monacoStickyTopBar },
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
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          wordBasedSuggestions: 'off',
          parameterHints: { enabled: false },
          acceptSuggestionOnEnter: 'off',
          tabCompletion: 'off',
          inlineSuggest: { enabled: false },
          lightbulb: { enabled: false },
          snippetSuggestions: 'none',
        }}
      />
    </div>
  );
}

export default MonacoEditorView;
