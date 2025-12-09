import React, { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import './MonacoEditorView.css';

/**
 * MonacoEditorView - Monaco editor component with custom #chapter/#section folding
 * 
 * This component provides a Monaco editor interface (VS Code editor) with:
 * - Custom folding for #chapter and #section markers
 * - Line numbers (array-like index display)
 * - Syntax highlighting for chapter/section headers
 * - AI eye icons for lines shared with AI
 */
function MonacoEditorView({ monacoRef, content, onContentChange }) {
  const foldingProviderRef = useRef(null);
  const decorationsRef = useRef([]);
  const [showPreviewBar, setShowPreviewBar] = useState(() => {
    if (typeof localStorage === 'undefined') return true;
    const saved = localStorage.getItem('showPreviewBar');
    return saved === null ? true : saved === 'true';
  });
  const [showLineNumbers, setShowLineNumbers] = useState(() => {
    const saved = localStorage.getItem('showMonacoLineNumbers');
    return saved === null ? true : saved === 'true';
  });

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

      // Chapter lines - eye icon + chapter decoration
      if (/^#chapter\b/.test(trimmed)) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'chapter-line-decoration',
            glyphMarginClassName: hasAiHide ? 'ai-hide-icon' : 'ai-eye-icon',
            glyphMarginHoverMessage: { value: hasAiHide ? 'Hidden from AI' : 'Shared with AI (click to toggle)' }
          }
        });
      }
      // Section lines - eye icon + section decoration
      else if (/^#section\b/.test(trimmed)) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'section-line-decoration',
            glyphMarginClassName: hasAiHide ? 'ai-hide-icon' : 'ai-eye-icon',
            glyphMarginHoverMessage: { value: hasAiHide ? 'Hidden from AI' : 'Shared with AI (click to toggle)' }
          }
        });
      }
      // Lines with AI tags - just eye icon
      else if (hasAiTag || hasAiHide) {
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

      // Define custom theme with transparent background
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
        colors: {
          'editor.background': '#00000000',
          'editorGutter.background': '#00000000',
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
    });

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

    // Set up change listener
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      onContentChange(value);
      updateDecorations(editor, monaco);
    });

    // Click ONLY on the eye icon to toggle AI visibility
    // Do NOT respond to fold arrow clicks (those should only fold/unfold)
    editor.onMouseDown((e) => {
      // Only respond to glyph margin clicks (where our eye icons are)
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        return;
      }

      // Check if the clicked element is our eye icon by checking its class
      const element = e.target.element;
      if (!element) return;
      
      const classList = element.classList;
      const isOurEyeIcon = classList && (classList.contains('ai-eye-icon') || classList.contains('ai-hide-icon'));
      
      if (!isOurEyeIcon) {
        return; // Not our eye icon - could be fold arrow or other glyph
      }

      const lineNumber = e.target.position?.lineNumber;
      if (!lineNumber) return;

      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(lineNumber);
      const trimmed = lineContent.trim().toLowerCase();

      // Only respond on chapter/section header lines
      if (/^#chapter\b/.test(trimmed) || /^#section\b/.test(trimmed)) {
        toggleAiHideForLine(lineNumber);
      }
    });

    // Initial decorations
    updateDecorations(editor, monaco);
  };

  // Listen for updates to the preview bar setting (from Settings window)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'showPreviewBar') {
        const next = e.newValue === null ? true : e.newValue === 'true';
        setShowPreviewBar(next);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Listen for updates to the Monaco line number setting
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'showMonacoLineNumbers') {
        const next = e.newValue === null ? true : e.newValue === 'true';
        setShowLineNumbers(next);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

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
          minimap: { enabled: showPreviewBar },
          fontSize: 14,
          lineNumbers: showLineNumbers ? 'on' : 'off',
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
