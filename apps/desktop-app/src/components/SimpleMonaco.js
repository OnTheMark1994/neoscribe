import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  selectContent,
  selectCurrentFilePath,
  selectFoldAllTrigger,
  selectUnfoldAllTrigger,
  selectSaveTrigger,
  setIsModified,
} from '../store/editorSlice';
import { showStatus } from '../store/statusSlice';
import {
  selectShowPreviewBar,
  selectShowMonacoLineNumbers,
  selectMonacoStickyTopBar,
  selectIsAIEnabled,
} from '../store/settingsSlice';
import Editor from '@monaco-editor/react';
import { saveFile } from '../utils/fileOps';
import { AiChangeManager } from './AiChangeManager';
import { selectAiProposals, selectActiveChangeId, setActiveChangeId } from '../store/aiSlice';
import './MonacoEditorView.css';
import './AiInlineDiff.css';

/**
 * SimpleMonaco - Monaco editor with AI proposal support
 * - Hidden line IDs for stable AI references
 * - View Zones for inline diff display
 * - Updates editor when file is opened (Redux content changes)
 */
const SimpleMonaco = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  const content = useSelector(selectContent);
  const showPreviewBar = useSelector(selectShowPreviewBar);
  const showLineNumbers = useSelector(selectShowMonacoLineNumbers);
  const monacoStickyTopBar = useSelector(selectMonacoStickyTopBar);
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const currentFilePath = useSelector(selectCurrentFilePath);
  const foldAllTrigger = useSelector(selectFoldAllTrigger);
  const unfoldAllTrigger = useSelector(selectUnfoldAllTrigger);
  const saveTrigger = useSelector(selectSaveTrigger);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const foldingProviderRef = useRef(null);
  const aiManagerRef = useRef(null);
  const lineIdToNumberRef = useRef(new Map());
  const contentChangeDisposableRef = useRef(null);
  
  const aiProposals = useSelector(selectAiProposals);
  const activeChangeId = useSelector(selectActiveChangeId);

  // Update editor when content changes (file opened)
  useEffect(() => {
    if (editorRef.current && content !== undefined) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== content) {
        editorRef.current.setValue(content);
      }
    }
  }, [content]);

  // Apply #chapter / #section styling and AI glyphs
  const updateDecorations = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
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
          options: { isWholeLine: true, className: 'monaco-chapter-line' },
        });
        if (isAIEnabled) {
          newDecorations.push({
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: { glyphMarginClassName: hasAiHide ? 'ai-hide-icon' : 'ai-eye-icon' },
          });
        }
      }

      if (/^#section\b/.test(trimmed)) {
        newDecorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: { isWholeLine: true, className: 'monaco-section-line' },
        });
        if (isAIEnabled) {
          newDecorations.push({
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: { glyphMarginClassName: hasAiHide ? 'ai-hide-icon' : 'ai-eye-icon' },
          });
        }
      }
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  };

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register custom scribefold language and folding provider (once)
    if (!window.__scribefoldLanguageRegistered) {
      monaco.languages.register({ id: 'scribefold' });

      foldingProviderRef.current = monaco.languages.registerFoldingRangeProvider('scribefold', {
        provideFoldingRanges(model) {
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
            }
          });

          while (stack.length > 0) {
            const prev = stack.pop();
            ranges.push({
              start: prev.lineNumber,
              end: lines.length,
              kind: monaco.languages.FoldingRangeKind.Region,
            });
          }

          return ranges;
        },
      });

      // Define and apply custom theme with transparent background and no line highlight boxes
      monaco.editor.defineTheme('scribefold-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#00000000',
          'editorGutter.background': '#00000000',
          // Remove any grey background used for folded regions
          'editor.foldBackground': '#00000000',
          'editor.lineHighlightBackground': '#00000000',
          'editor.lineHighlightBorder': '#00000000',
          'editor.wordHighlightBackground': '#00000000',
          'editor.wordHighlightStrongBackground': '#00000000',
          'editor.selectionHighlightBackground': '#00000000',
        },
      });

      window.__scribefoldLanguageRegistered = true;
    }

    monaco.editor.setTheme('scribefold-dark');

    // Ensure folding UI is enabled
    editor.updateOptions({
      folding: true,
      foldingHighlight: true,
      showFoldingControls: 'always',
    });

    // Focus editor so caret is visible immediately
    editor.focus();

    // Initialize AI Change Manager
    aiManagerRef.current = new AiChangeManager(editor, dispatch);

    // Initial decoration once on mount
    updateDecorations();

    // Listen for content changes (debounced) so we can keep line maps fresh
    let idInjectionTimeout = null;
    if (contentChangeDisposableRef.current) {
      contentChangeDisposableRef.current.dispose();
      contentChangeDisposableRef.current = null;
    }
    contentChangeDisposableRef.current = editor.onDidChangeModelContent(() => {
      if (idInjectionTimeout) clearTimeout(idInjectionTimeout);
      idInjectionTimeout = setTimeout(() => {
        updateLineIdMap(editor);
      }, 1000); // Debounce 1 second
    });

    // Click on glyph margin eye icon: toggle #ai-hide tag on that line
    editor.onMouseDown((e) => {
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;

      const position = e.target.position;
      if (!position || !position.lineNumber) return;

      const lineNumber = position.lineNumber;
      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(lineNumber);
      const hasHide = /\s#ai-hide\b/.test(lineContent);
      let newLine = lineContent;

      if (hasHide) {
        // Remove existing #ai-hide
        newLine = lineContent.replace(/\s#ai-hide\b/, '');
      } else {
        // Append #ai-hide
        const needsSpace = /\s$/.test(lineContent) || lineContent.length === 0;
        newLine = lineContent + (needsSpace ? '' : ' ') + '#ai-hide';
      }

      model.pushEditOperations(
        [],
        [
          {
            range: new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1),
            text: newLine,
          },
        ],
        () => null
      );

      // Refresh decorations once for the updated content
      updateDecorations();
    });
  };

  // Re-apply decorations when AI setting changes or when we know content was replaced
  useEffect(() => {
    updateDecorations();
  }, [isAIEnabled, content]);

  // Cleanup folding provider and AI manager on unmount
  useEffect(() => {
    return () => {
      if (foldingProviderRef.current) {
        foldingProviderRef.current.dispose();
        foldingProviderRef.current = null;
      }
      if (contentChangeDisposableRef.current) {
        contentChangeDisposableRef.current.dispose();
        contentChangeDisposableRef.current = null;
      }
      if (aiManagerRef.current) {
        aiManagerRef.current.dispose();
        aiManagerRef.current = null;
      }
    };
  }, []);

  // Respond to fold all trigger
  useEffect(() => {
    if (!foldAllTrigger) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const action = editor.getAction('editor.foldAll');
    if (action) action.run();
  }, [foldAllTrigger]);

  // Respond to unfold all trigger
  useEffect(() => {
    if (!unfoldAllTrigger) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const action = editor.getAction('editor.unfoldAll');
    if (action) action.run();
  }, [unfoldAllTrigger]);

  // Respond to save trigger (Electron): save file using current content
  useEffect(() => {
    if (!saveTrigger) return;
    const editor = editorRef.current;
    if (!editor) return;

    const text = editor.getValue();

    (async () => {
      const result = await saveFile(currentFilePath, text);
      if (result.success) {
        dispatch(setIsModified(false));
        if (result.filePath) {
          // If saveAs returned a new path, update Redux
          dispatch({ type: 'editor/setCurrentFilePath', payload: result.filePath });
        }
        dispatch(showStatus('File saved'));
      } else if (result.error) {
        dispatch(showStatus('Failed to save file: ' + result.error));
      }
    })();
  }, [saveTrigger, currentFilePath, dispatch]);

  // Update AI proposals when Redux changes
  useEffect(() => {
    if (!aiManagerRef.current || !aiProposals) return;
    
    const lineIdMap = updateLineIdMap(editorRef.current);
    if (lineIdMap) {
      lineIdToNumberRef.current = lineIdMap;
    }
    
    const changes = flattenProposals(aiProposals);
    aiManagerRef.current.updateChanges(changes, lineIdToNumberRef.current);
    
    // Auto-focus first change if we have a new set
    if (changes.length > 0 && !activeChangeId) {
      dispatch(setActiveChangeId(changes[0].id));
      aiManagerRef.current.activeChangeId = changes[0].id;
    }
  }, [aiProposals, dispatch, activeChangeId]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    prepareForAI: () => {
      if (!editorRef.current || !monacoRef.current) return [];
      return buildLinesFromMonaco(editorRef.current);
    },
    getEditor: () => editorRef.current,
    getLineIdToNumberMap: () => lineIdToNumberRef.current,
    getAiManager: () => aiManagerRef.current,
  }));

  return (
    <div className="monaco-editor-container">
      <Editor
        height="100%"
        defaultLanguage="scribefold"
        defaultValue={content || ''}
        onMount={handleMount}
        theme="scribefold-dark"
        options={{
          // Layout / appearance from settings
          lineNumbers: showLineNumbers ? 'on' : 'off',
          glyphMargin: isAIEnabled,
          minimap: { enabled: showPreviewBar },
          stickyScroll: { enabled: monacoStickyTopBar },
          padding: { top: showPreviewBar ? 0 : 16, bottom: 16 },

          // General editor feel
          wordWrap: 'on',
          scrollBeyondLastLine: true,
          fontSize: 14,
          lineHeight: 24,
          renderLineHighlight: 'none',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,

          // Disable vertical indent guides so there's no line between arrows and text
          renderIndentGuides: false,
          guides: {
            indentation: false,
            highlightActiveIndentation: false,
          },

          // Turn off suggestions / intellisense noise
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          parameterHints: { enabled: false },
          wordBasedSuggestions: false,
          tabCompletion: 'off',

          // Turn off highlighting of all occurrences of the word under the cursor
          occurrencesHighlight: false,
          selectionHighlight: false,
        }}
      />
    </div>
  );
});

/**
 * Generate stable ID from line index and content
 */
function generateStableId(index, text) {
  let hash = 0;
  const str = text.trim();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `l${index}_${Math.abs(hash).toString(36)}`;
}

/**
 * Update the lineID → lineNumber map using in-memory IDs
 */
function updateLineIdMap(editor) {
  if (!editor) return;
  const model = editor.getModel();
  if (!model) return;

  const map = new Map();
  for (let i = 1; i <= model.getLineCount(); i++) {
    const fullLine = model.getLineContent(i);
    const id = generateStableId(i, fullLine);
    map.set(id, i);
  }
  return map;
}

/**
 * Build lines array from Monaco for AI
 * Uses in-memory stable IDs, parses levels, etc.
 */
function buildLinesFromMonaco(editor) {
  const model = editor.getModel();
  if (!model) return [];

  const lines = [];
  for (let i = 1; i <= model.getLineCount(); i++) {
    const fullLine = model.getLineContent(i);
    const id = generateStableId(i, fullLine);
    const text = fullLine.trimEnd();
    
    // Parse level from #chapter/#section
    let level = 0;
    const trimmed = text.trim().toLowerCase();
    if (/^#chapter\b/.test(trimmed)) level = 1;
    else if (/^#section\b/.test(trimmed)) level = 2;
    
    // Determine sendToAI mode
    let sendToAI = 'all';
    if (/#ai-hide\b/i.test(text)) sendToAI = 'none';
    else if (/#ai-title\b/i.test(text)) sendToAI = 'title';
    else if (/#ai-summary\b/i.test(text)) sendToAI = 'summary';
    
    lines.push({
      id,
      text,
      level,
      startIdx: i - 1,
      endIdx: i - 1,
      sendToAI,
      open: true,
    });
  }

  return lines;
}

/**
 * Flatten Redux proposals to array for AiChangeManager
 */
function flattenProposals(aiProposals) {
  const changes = [];
  Object.entries(aiProposals).forEach(([lineId, proposalArray]) => {
    if (Array.isArray(proposalArray)) {
      proposalArray.forEach((proposal) => {
        changes.push({
          ...proposal,
          lineID: lineId,
        });
      });
    }
  });
  return changes;
}

export default SimpleMonaco;
