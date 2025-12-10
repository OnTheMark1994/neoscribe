import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';
import {
  selectShowPreviewBar,
  selectShowMonacoLineNumbers,
  selectMonacoStickyTopBar,
  selectIsAIEnabled
} from '../../store/settingsSlice';
import '../MonacoEditorView.css';

function MonacoEditorView({ monacoRef, defaultValue, onMount }) {
  const foldingProviderRef = useRef(null);
  const decorationsRef = useRef([]);
  
  // New refs to hold editor/monaco instances and disposables
  const editorRef = useRef(null);
  const monacoInstanceRef = useRef(null);
  const disposablesRef = useRef([]);

  const showPreviewBar = useSelector(selectShowPreviewBar);
  const showLineNumbers = useSelector(selectShowMonacoLineNumbers);
  const monacoStickyTopBar = useSelector(selectMonacoStickyTopBar);
  const isAIEnabled = useSelector(selectIsAIEnabled);

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

      if (/^#chapter\b/.test(trimmed)) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: { isWholeLine: true, className: 'monaco-chapter-line' }
        });
        if (isAIEnabled && !hasAiHide) {
          newDecorations.push({
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: { glyphMarginClassName: hasAiTag ? 'monaco-ai-icon-tag' : 'monaco-ai-icon' }
          });
        }
      }

      if (/^#section\b/.test(trimmed)) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: { isWholeLine: true, className: 'monaco-section-line' }
        });
        if (isAIEnabled && !hasAiHide) {
          newDecorations.push({
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: { glyphMarginClassName: hasAiTag ? 'monaco-ai-icon-tag' : 'monaco-ai-icon' }
          });
        }
      }

      const isRegularLine = !/^#chapter\b/.test(trimmed) && !/^#section\b/.test(trimmed);
      if (isAIEnabled && isRegularLine && !hasAiHide) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: { glyphMarginClassName: hasAiTag ? 'monaco-ai-icon-tag' : 'monaco-ai-icon' }
        });
      }
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  };

  // ←←← CLEAN onMount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoInstanceRef.current = monaco;

    if (monacoRef) monacoRef.current = editor;
    if (onMount) onMount(editor);

    // Register folding provider (unchanged)
    const foldingProvider = monaco.languages.registerFoldingRangeProvider('plaintext', {
      provideFoldingRanges(model) {
        const lines = model.getLinesContent();
        const ranges = [];

        lines.forEach((line, i) => {
          const lineNum = i + 1;
          const trimmed = line.trim().toLowerCase();

          if (/^#chapter\b/.test(trimmed)) {
            let end = lines.length;
            for (let j = i + 1; j < lines.length; j++) {
              if (/^#chapter\b/.test(lines[j].trim().toLowerCase())) {
                end = j;
                break;
              }
            }
            if (end > lineNum) ranges.push({ start: lineNum, end, kind: monaco.languages.FoldingRangeKind.Region });
          }

          if (/^#section\b/.test(trimmed)) {
            let end = lines.length;
            for (let j = i + 1; j < lines.length; j++) {
              const next = lines[j].trim().toLowerCase();
              if (/^#chapter\b/.test(next) || /^#section\b/.test(next)) {
                end = j;
                break;
              }
            }
            if (end > lineNum) ranges.push({ start: lineNum, end, kind: monaco.languages.FoldingRangeKind.Region });
          }
        });

        return ranges;
      }
    });

    foldingProviderRef.current = foldingProvider;

    // Initial decoration
    updateDecorations(editor, monaco);
  };

  // ←←← THE IMPORTANT useEffect – runs once when editor is ready + when AI is toggled
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoInstanceRef.current;
    if (!editor || !monaco) return;

    let timeoutId = null;

    const scheduleUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateDecorations(editor, monaco);
        // Cheap way to refresh folding UI
        editor.trigger('', 'editor.foldAll', {});
        editor.trigger('', 'editor.unfoldAll', {});
      }, 350);
    };

    // Run once immediately
    updateDecorations(editor, monaco);

    const contentListener = editor.onDidChangeModelContent(scheduleUpdate);

    const configListener = editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(monaco.editor.EditorOption.glyphMargin)) {
        updateDecorations(editor, monaco);
      }
    });

    disposablesRef.current = [contentListener, configListener];

    return () => {
      clearTimeout(timeoutId);
      disposablesRef.current.forEach(d => d.dispose());
      disposablesRef.current = [];
    };
  }, [isAIEnabled]); // re-run when AI toggle changes glyphMargin visibility

  // Cleanup folding provider on unmount
  useEffect(() => {
    return () => {
      foldingProviderRef.current?.dispose();
    };
  }, []);

  return (
    <div className="monaco-editor-container">
      <Editor
        defaultLanguage="plaintext"
        defaultValue={defaultValue}
        onMount={handleEditorDidMount}
        options={{
          lineNumbers: showLineNumbers ? 'on' : 'off',
          glyphMargin: isAIEnabled,
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          wordWrap: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineHeight: 24,
          stickyScroll: { enabled: monacoStickyTopBar },
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          padding: { top: showPreviewBar ? 0 : 16, bottom: 16 }
        }}
        theme="vs-dark"
      />
    </div>
  );
}

export default MonacoEditorView;