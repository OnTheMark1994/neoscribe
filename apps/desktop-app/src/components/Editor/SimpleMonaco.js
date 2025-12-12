import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useSelector, useDispatch } from 'react-redux';
import { 
  selectContent,
  selectCurrentFilePath,
  selectFoldAllTrigger,
  selectUnfoldAllTrigger,
  selectSaveTrigger,
  setIsModified,
} from '../../store/editorSlice';
import { showStatus } from '../../store/statusSlice';
import {
  selectShowPreviewBar,
  selectShowMonacoLineNumbers,
  selectMonacoStickyTopBar,
  selectIsAIEnabled,
} from '../../store/settingsSlice';
import { selectAiProposals, selectActiveChangeId } from '../../store/aiSlice';
import { showAiContextMenu } from '../../store/aiUiSlice';
import Editor, { DiffEditor } from '@monaco-editor/react';
import DiffActionButtons from '../AI/DiffActionButtons';
import DiffNavigation from '../AI/DiffNavigation';
import { saveFile } from '../../utils/fileOps';
import './MonacoEditorView.css';

/**
 * SimpleMonaco - Plain Monaco editor
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
  const aiProposals = useSelector(selectAiProposals);
  const activeChangeId = useSelector(selectActiveChangeId);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const foldingProviderRef = useRef(null);
  const diffEditorRef = useRef(null);
  const diffZonesRef = useRef([]);
  const diffZoneRootsRef = useRef([]);

  // Check if we have AI proposals to show diff mode
  const hasProposals = aiProposals && Object.keys(aiProposals).length > 0;
  const showDiffMode = hasProposals;

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

      // Define and apply custom theme with transparent background and black text
      // Use a light base theme so black foreground looks natural while we
      // keep the editor background transparent to match the array view.
      monaco.editor.defineTheme('scribefold-dark', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#00000000',
          'editorGutter.background': '#00000000',
          'editor.foreground': '#000000',
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

    // Initial decoration once on mount
    updateDecorations();

    // Left-click on glyph margin eye icon: toggle #ai-hide on that line
    editor.onMouseDown((e) => {
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;

      const domEvent = e.browserEvent || e.event?.browserEvent || e.event;
      const button = domEvent && typeof domEvent.button === 'number' ? domEvent.button : 0;
      if (button !== 0) return; // only handle left-click here

      const position = e.target.position;
      if (!position || !position.lineNumber) return;

      const lineNumber = position.lineNumber;
      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(lineNumber) || '';

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

    // Right-click (context menu) on glyph margin eye icon: open shared AI context menu
    editor.onContextMenu((e) => {
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;

      const domEvent = e.browserEvent || e.event?.browserEvent || e.event;
      if (domEvent) {
        domEvent.preventDefault();
      }

      const position = e.target.position;
      if (!position || !position.lineNumber) return;

      const lineNumber = position.lineNumber;
      const model = editor.getModel();
      if (!model) return;

      const lineContent = model.getLineContent(lineNumber) || '';

      let level = 0;
      const trimmed = lineContent.trim().toLowerCase();
      if (/^#chapter\b/.test(trimmed)) level = 1;
      else if (/^#section\b/.test(trimmed)) level = 2;

      if (level === 0 || !domEvent) return; // only chapter/section get menu

      dispatch(showAiContextMenu({
        x: domEvent.clientX,
        y: domEvent.clientY,
        level,
      }));
    });
  };

  // Re-apply decorations when AI setting changes or when we know content was replaced
  useEffect(() => {
    updateDecorations();
  }, [isAIEnabled, content]);

  // Cleanup folding provider on unmount
  useEffect(() => {
    return () => {
      if (foldingProviderRef.current) {
        foldingProviderRef.current.dispose();
        foldingProviderRef.current = null;
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


  // Apply AI proposals to content to generate modified version
  const applyProposalsToContent = (originalContent, proposals) => {
    if (!originalContent || !proposals) return originalContent;

    const lines = originalContent.split('\n');
    const linesWithIds = buildLinesFromContent(originalContent);
    const modifiedLines = [...lines];

    // Apply each proposal
    Object.entries(proposals).forEach(([lineId, proposalArray]) => {
      if (!Array.isArray(proposalArray)) return;

      // Find the line index for this lineId
      const lineIndex = linesWithIds.findIndex(l => l.id === lineId);
      if (lineIndex === -1) return;

      proposalArray.forEach(proposal => {
        if (proposal.type === 'modify' && proposal.proposedText != null) {
          modifiedLines[lineIndex] = proposal.proposedText;
        } else if (proposal.type === 'insert' && Array.isArray(proposal.linesToInsert)) {
          // Insert after the current line
          modifiedLines.splice(lineIndex + 1, 0, ...proposal.linesToInsert);
        } else if (proposal.type === 'delete') {
          modifiedLines[lineIndex] = ''; // Mark for deletion
        }
      });
    });

    return modifiedLines.filter(line => line !== '').join('\n');
  };

  // Generate modified content when proposals exist
  const originalContent = content || '';
  const modifiedContent = showDiffMode ? applyProposalsToContent(originalContent, aiProposals) : originalContent;

  // Diff editor mount handler
  const handleDiffMount = (editor, monaco) => {
    diffEditorRef.current = editor;
    monacoRef.current = monaco;

    if (!window.__scribefoldDiffThemeRegistered) {
      monaco.editor.defineTheme('scribefold-diff-dark', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#00000000',
          'editorGutter.background': '#00000000',
          'editor.foreground': '#000000',
        },
      });
      window.__scribefoldDiffThemeRegistered = true;
    }

    monaco.editor.setTheme('scribefold-diff-dark');

    const modifiedEditor = editor.getModifiedEditor();
    if (modifiedEditor) {
      modifiedEditor.focus();
    }

    // Initial placement of diff action buttons when diff editor mounts
    // Add small delay to ensure editor is fully ready
    setTimeout(() => {
      console.log('[DiffMount] Calling updateDiffActionZones after mount');
      updateDiffActionZones();
    }, 100);
  };

  // Create / update Monaco view zones for DiffActionButtons on modified side
  const updateDiffActionZones = () => {
    console.log('[DiffZones] updateDiffActionZones called', {
      showDiffMode,
      hasDiffEditor: !!diffEditorRef.current,
      hasOriginalContent: !!originalContent,
      aiProposalsKeys: Object.keys(aiProposals || {}),
    });

    if (!showDiffMode || !diffEditorRef.current || !originalContent) {
      console.log('[DiffZones] Early return - missing prerequisites');
      return;
    }

    const diffEditor = diffEditorRef.current;
    const monaco = monacoRef.current;
    if (!monaco) {
      console.log('[DiffZones] No monaco instance');
      return;
    }

    const modifiedEditor = diffEditor.getModifiedEditor();
    if (!modifiedEditor) {
      console.log('[DiffZones] No modified editor');
      return;
    }

    const model = modifiedEditor.getModel();
    if (!model) {
      console.log('[DiffZones] No model');
      return;
    }

    const linesWithIds = buildLinesFromContent(originalContent);
    console.log('[DiffZones] Lines with IDs:', linesWithIds.length, linesWithIds.map(l => ({ id: l.id, text: l.text.substring(0, 30) })));

    // Clear existing zones and unmount React roots
    modifiedEditor.changeViewZones(accessor => {
      diffZonesRef.current.forEach(id => accessor.removeZone(id));
      diffZonesRef.current = [];
    });
    
    // Unmount all React roots
    diffZoneRootsRef.current.forEach(root => {
      try {
        root.unmount();
      } catch (e) {
        console.warn('[DiffZones] Error unmounting root:', e);
      }
    });
    diffZoneRootsRef.current = [];

    // Add a view zone after each line with proposals
    let zonesAdded = 0;
    modifiedEditor.changeViewZones(accessor => {
      Object.entries(aiProposals || {}).forEach(([lineId, proposalArray]) => {
        console.log('[DiffZones] Processing lineId:', lineId, 'proposals:', proposalArray);
        
        if (!Array.isArray(proposalArray) || proposalArray.length === 0) {
          console.log('[DiffZones] Skipping - not an array or empty');
          return;
        }

        const lineIndex = linesWithIds.findIndex(l => l.id === lineId);
        console.log('[DiffZones] Line index for', lineId, ':', lineIndex);
        
        if (lineIndex === -1) {
          console.log('[DiffZones] Skipping - lineId not found in linesWithIds');
          return;
        }

        // Use the first proposal object for button props (type/id etc.)
        const proposal = proposalArray[0];

        let afterLineNumber = lineIndex + 1;
        if (proposal.type === 'insert' && Array.isArray(proposal.linesToInsert)) {
          // Place buttons after the inserted block in the modified view
          afterLineNumber = lineIndex + 1 + proposal.linesToInsert.length;
        }

        if (afterLineNumber > model.getLineCount()) {
          afterLineNumber = model.getLineCount();
        }

        console.log('[DiffZones] Adding zone after line', afterLineNumber, 'for proposal type:', proposal.type);

        const domNode = document.createElement('div');
        domNode.style.zIndex = '1000';
        domNode.style.position = 'relative';

        const zoneId = accessor.addZone({
          afterLineNumber,
          heightInPx: 60,
          domNode,
        });

        diffZonesRef.current.push(zoneId);
        zonesAdded++;

        // Use React 18's createRoot API
        const root = createRoot(domNode);
        root.render(
          <DiffActionButtons
            proposedChangeId={proposal.id}
            changeType={proposal.type}
            activeChangeId={activeChangeId}
          />
        );
        diffZoneRootsRef.current.push(root);
      });
    });
    
    console.log('[DiffZones] Total zones added:', zonesAdded);
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    prepareForAI: () => {
      if (showDiffMode && diffEditorRef.current) {
        const modEditor = diffEditorRef.current.getModifiedEditor();
        if (modEditor) return buildLinesFromMonaco(modEditor);
      }
      if (editorRef.current && monacoRef.current) {
        return buildLinesFromMonaco(editorRef.current);
      }
      return [];
    },
    getEditor: () => showDiffMode ? diffEditorRef.current?.getModifiedEditor() : editorRef.current,
  }));

  // Rebuild diff action zones whenever proposals, content, or active ID changes
  useEffect(() => {
    updateDiffActionZones();
  }, [showDiffMode, aiProposals, originalContent, activeChangeId]);

  // Conditionally render diff mode or normal editor
  if (showDiffMode) {
    return (
      <>
        <div className="monaco-editor-container">
          <DiffEditor
            height="100%"
            language="scribefold"
            original={originalContent}
            modified={modifiedContent}
            onMount={handleDiffMount}
            theme="scribefold-diff-dark"
            options={{
              lineNumbers: showLineNumbers ? 'on' : 'off',
              minimap: { enabled: showPreviewBar },
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
        <DiffNavigation />
      </>
    );
  }

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
 * Build lines array from content string for AI
 * Uses in-memory stable IDs, parses levels, etc.
 */
function buildLinesFromContent(content) {
  if (!content) return [];
  
  const textLines = content.split('\n');
  const lines = [];
  
  textLines.forEach((fullLine, index) => {
    const id = generateStableId(index + 1, fullLine);
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
      startIdx: index,
      endIdx: index,
      sendToAI,
      open: true,
    });
  });

  return lines;
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

export default SimpleMonaco;
