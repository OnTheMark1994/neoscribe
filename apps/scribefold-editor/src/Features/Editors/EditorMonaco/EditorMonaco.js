/*
 
 
  */
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { openRightClickWindow } from '../../../Global/ReduxSlices/WindowSlice';
import { setModified } from '../../../Global/ReduxSlices/EditorSlice';
import Editor from '@monaco-editor/react';
import PerformanceTest from './PerformanceTest';
import './EditorMonaco.css';
import { getLinesArrayWithAssertedIds, createLineMetadataDecoration, getLineMetadataFromDecorations } from './MonacoFunctions';


export default function EditorMonaco({ monacoEditorRef }) {
  const dispatch = useDispatch();

  // User preferences that should affect Monaco rendering.
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const proposedChanges = useSelector(state => state.aiSlice.proposedChanges);
  const filepath = useSelector(state => state.editorSlice.filepath);

  // Keeping settings object in a ref so the monaco functions can access it 
  const settingsObjectRef = useRef()
  useEffect(() => {
    settingsObjectRef.current = settingsObject
  }, [settingsObject]);

  // The proposed changes just logging for now
  useEffect(() => {
    console.log('[EditorMonaco] proposedChanges updated:', proposedChanges);
  }, [proposedChanges]);

  // Re check for ai share icons on enter press (in case a new chapter or section has been added or removed)
  useEffect(() => {
      const handleKeypress = (e) => {
        if(e.key === "Enter")
          monacoEditorRef.current?.updateDecorations()
      };
      document.addEventListener('keypress', handleKeypress);
      return () => document.removeEventListener('mousedown', handleKeypress);
  }, []);

  // Show/hide AI icons when settings.aiModeActive changes
  useEffect(()=>{
    monacoEditorRef.current?.updateDecorations()
  },[settingsObject?.aiModeActive])

  const [showPerformanceTest, setShowPerformanceTest] = useState(false);
  const decorationsRef = useRef(null);


  // This is for initial file load on start
  const firstChangeRef = useRef(true)
  function handleChange(){
    if(!firstChangeRef.current) return
    firstChangeRef.current = false
    monacoEditorRef.current?.updateDecorations()
  }

  // When a new file is loaded (file => open) we updateDecorations
  useEffect(()=>{
    monacoEditorRef.current?.updateDecorations()
  },[filepath])

  return (
    <div className="editorMonacoContainer">
      {/* {showPerformanceTest && (
        <PerformanceTest 
          editorRef={monacoEditorRef} 
          onClose={() => setShowPerformanceTest(false)}
        />
      )} */}

      {/* <button 
        className="performance-test-toggle"
        onClick={() => setShowPerformanceTest(!showPerformanceTest)}
      >
        {showPerformanceTest ? 'Hide Performance Test' : 'Show Performance Test'}
      </button> */}
      <Editor
        height="100%"
        defaultLanguage="plaintext"
        defaultValue=""
        onMount={(editor, monaco) => {
          if (monacoEditorRef) {
            monacoEditorRef.current = editor;
          }

          const model = editor.getModel?.();
          if (model) {
            dispatch(setModified(false));

            model.onDidChangeContent(() => {
              if (editor.__sfIsHydrating) return;
              dispatch(setModified(true));
            });
          }
          
        // Helper for updateDecorations
        const getSectionIcon = (isSection, isHidden, parentChapterHidden) => {
          // Chapter logic
          if (!isSection) {
            return isHidden ? 'ai-hide-icon' : 'ai-eye-icon';
          }
          
          // Section logic
          if (parentChapterHidden) {
            // Chapter is hidden, section is always grey-eye (even if section is shown)
            return 'ai-eye-icon-grey';
          } else {
            // Chapter is shown, section uses its own visibility
            return isHidden ? 'ai-hide-icon' : 'ai-eye-icon';
          }
        };

        // Helper for updateDecorations
        const getSectionHoverMessage = (isSection, isHidden, parentChapterHidden) => {
          if (!isSection) {
            return isHidden ? 'Hidden from AI' : 'Visible to AI';
          }
          
          if (parentChapterHidden) {
            return 'Hidden because parent chapter hidden';
          }
          
          return isHidden ? 'Hidden from AI' : 'Visible to AI';
        };

        const updateDecorations = () => {
          console.log("updateDecorations");

          const model = editor.getModel();
          if (!model) return;
          
          decorationsRef.current = editor.deltaDecorations(decorationsRef.current || [], []);
          
          if (!settingsObjectRef.current?.aiModeActive) return;

          const lines = model.getLinesContent();
          const newDecorations = [];
          
          // Track the current chapter's hidden state
          let currentChapterHidden = false;
          
          lines.forEach((line, index) => {
            const lineNumber = index + 1;
            const trimmed = line.trim();
            
            if (!trimmed.startsWith('#chapter') && !trimmed.startsWith('#section')) {
              return;
            }

            const lineDecorations = model.getLineDecorations(lineNumber);
            const metadata = getLineMetadataFromDecorations(lineDecorations) || {};
            const isHidden = metadata.aiShare === 'hide';
            
            const isSection = trimmed.startsWith('#section');
            
            if (!isSection) {
              // Update current chapter state
              currentChapterHidden = isHidden;
            }
            
            const iconClass = getSectionIcon(isSection, isHidden, currentChapterHidden);
            const hoverMessage = getSectionHoverMessage(isSection, isHidden, currentChapterHidden);
            
            newDecorations.push({
              range: new monaco.Range(lineNumber, 1, lineNumber, 1),
              options: {
                glyphMarginClassName: iconClass,
                glyphMarginHoverMessage: { value: hoverMessage },
                stickiness: 1 /* NeverGrowsWhenTypingAtEdges */
              }
            });
          });
          
          decorationsRef.current = editor.deltaDecorations(decorationsRef.current || [], newDecorations);
        };

          // Attach this function to the editor ref so it can be accessed anywher ehte editor ref is
          editor.updateDecorations = updateDecorations

          const toggleAiShareForLine = (lineNumber) => {
            const model = editor.getModel();
            if (!model) return;

            const existingLineDecorations = model.getLineDecorations(lineNumber);
            const existingMetadata = getLineMetadataFromDecorations(existingLineDecorations) || {};

            const isHidden = existingMetadata.aiShare === 'hide';
            const newMetadata = {
              ...existingMetadata,
              aiShare: isHidden ? undefined : 'hide',
            };

            const newDecoration = createLineMetadataDecoration(lineNumber, newMetadata);

            const metaDecorations = existingLineDecorations
              .filter(d => d.options.description?.startsWith('sf_meta:'));
            const oldDecorationIds = metaDecorations.map(d => d.id);

            editor.deltaDecorations(oldDecorationIds, [newDecoration]);
            editor.layout();
            updateDecorations();
          };
          editor.toggleAiShareForLine = toggleAiShareForLine

          // Allow RightClickWindow actions to toggle aiShare for a line.
          // This keeps the source of truth in the Monaco line metadata decoration.
          if (!editor.__sfEyeToggleHandlerAttached) {
            editor.__sfEyeToggleHandlerAttached = true;
            editor.__sfToggleAiShareForLine = toggleAiShareForLine;
          }
          
          // Toggle aiShare metadata on click
          editor.onMouseDown((e) => {
            if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
              console.log('[DEBUG] Ignoring non-glyph click');
              return;
            }

            if(e.event.rightButton){
                e.event.preventDefault(); // THIS prevents browser context menu
                e.event.stopPropagation();

                console.log('Right-click on eye icon:', {
                  x: e.event.browserEvent.clientX,
                  y: e.event.browserEvent.clientY,
                  pageX: e.event.browserEvent.pageX,
                  pageY: e.event.browserEvent.pageY,
                });

                const { clientX: x, clientY: y } = e.event.browserEvent;
                const lineNumber = e.target.position?.lineNumber || null;
                  dispatch(openRightClickWindow({ 
                    left: x, 
                    top: y,
                    type: 'eyeIcon',
                    lineNumber,
                  }));


            }
            // On left click toggle
            else{
              console.log('[DEBUG] Mouse event received', {
                targetType: e.target.type,
                position: e.target.position,
                lineNumber: e.target.position?.lineNumber
              });
              
  
              const position = e.target.position;
              if (!position || !position.lineNumber) {
                console.log('[DEBUG] Missing position/lineNumber');
                return;
              }
              
              const lineNumber = position.lineNumber;
              toggleAiShareForLine(lineNumber);
              
              console.log('[DEBUG] Editor layout forced, decorations updated');

            }
          });

          // Preventing browser right click menu on glyph right click
          window.addEventListener('contextmenu', (e) => {
            // if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
            if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
              console.log('[DEBUG] Ignoring non-glyph click');
              return;
            }
            e.preventDefault(); // THIS stops the browser menu
          
          }, true);
          // Initial decoration update
          updateDecorations();
          
          const foldingProvider = monaco.languages.registerFoldingRangeProvider('plaintext', {
            provideFoldingRanges: (model) => {
              // Monaco calls this on-demand (and potentially often) to determine foldable regions.
              // Important behavior detail:
              // - Once you register a custom folding provider for a language, Monaco uses it as the
              //   source of truth for folding ranges (default indentation folding won't apply).
              // So we generate *both* types of folds here:
              // - Primary containers: lines beginning with #chapter / #section
              // - Secondary folds: indentation-based folds, but only within the active container
              const lines = model.getLinesContent();
              const ranges = [];

              const addRange = (start, end) => {
                // Helper to add a valid fold range. Monaco ignores invalid ranges.
                // start/end are 1-based line numbers.
                if (!start || !end) return;
                if (end <= start) return;
                ranges.push({
                  start,
                  end,
                  kind: monaco.languages.FoldingRangeKind.Region,
                });
              };

              // -------- Precompute per-line facts (O(n)) --------
              // These arrays let us avoid nested scans and expensive repeated work.
              const n = lines.length;
              const isEmpty = new Array(n + 1);
              const indent = new Array(n + 1);
              const isChapter = new Array(n + 1);
              const isSection = new Array(n + 1);
              const isMarker = new Array(n + 1);
              const nextNonEmpty = new Array(n + 1);
              const nextMarker = new Array(n + 1);

              const countIndent = (rawLine) => {
                // Cheap indentation counter (no regex). Tabs are treated as width=2.
                const s = String(rawLine ?? '');
                let count = 0;
                for (let i = 0; i < s.length; i++) {
                  const ch = s[i];
                  if (ch === ' ') count += 1;
                  else if (ch === '\t') count += 2;
                  else break;
                }
                return count;
              };

              const ltrim = (rawLine) => {
                // Trim only leading whitespace so marker checks can be done with startsWith.
                const s = String(rawLine ?? '');
                let i = 0;
                while (i < s.length) {
                  const ch = s[i];
                  if (ch === ' ' || ch === '\t') i++;
                  else break;
                }
                return s.slice(i);
              };

              for (let ln = 1; ln <= n; ln++) {
                // Per-line classification:
                // - empty vs non-empty
                // - indentation level
                // - whether this line is a marker (#chapter/#section)
                const raw = lines[ln - 1] ?? '';
                const trimmed = String(raw).trim();
                isEmpty[ln] = trimmed.length === 0;
                indent[ln] = countIndent(raw);

                const lt = ltrim(raw);
                const ch = lt.startsWith('#chapter');
                const se = lt.startsWith('#section');
                isChapter[ln] = ch;
                isSection[ln] = se;
                isMarker[ln] = ch || se;
              }

              // nextNonEmpty[ln] lets us look ahead to the next *meaningful* line without scanning.
              // This is the key to being blank-line-safe while staying O(n).
              nextNonEmpty[n] = null;
              let nextNE = null;
              for (let ln = n; ln >= 1; ln--) {
                nextNonEmpty[ln] = nextNE;
                if (!isEmpty[ln]) nextNE = ln;
              }

              // nextMarker[ln] points to the next chapter/section marker (or null if none).
              // Used to clamp indentation folding so it never crosses marker boundaries.
              nextMarker[n] = null;
              let nextM = null;
              for (let ln = n; ln >= 1; ln--) {
                nextMarker[ln] = nextM;
                if (isMarker[ln]) nextM = ln;
              }

              // -------- Single-pass folding (O(n)) --------
              // We walk the document once:
              // - When we hit a marker, we close the previous marker-range(s) and reset indent folding.
              // - For non-marker lines inside the active container, we build indentation folds using a stack.
              let lastChapterLine = -1;
              let lastSectionLine = -1;
              let activeContainerStart = -1;
              let activeContainerEnd = -1;
              let lastNonEmptyInContainer = -1;
              const indentStack = [];

              const setActiveContainer = (startLine) => {
                // Define the active region in which indentation folds are allowed.
                // The container ends at the next marker-1 (or EOF).
                activeContainerStart = startLine;
                const nm = startLine > 0 ? nextMarker[startLine] : null;
                activeContainerEnd = nm ? (nm - 1) : n;
                lastNonEmptyInContainer = -1;
                indentStack.length = 0;
              };

              const closeIndentStackAt = (endLine) => {
                // Close any open indentation folds at a boundary (marker boundary or EOF).
                // We use lastNonEmptyInContainer so blank lines don't extend folds unnecessarily.
                const end = Math.min(endLine, lastNonEmptyInContainer > 0 ? lastNonEmptyInContainer : endLine);
                while (indentStack.length > 0) {
                  const top = indentStack.pop();
                  addRange(top.startLine, end);
                }
              };

              for (let ln = 1; ln <= n; ln++) {
                if (isChapter[ln]) {
                  // #chapter starts a new top-level container.
                  // We close:
                  // - any open indentation folds in the previous container
                  // - the previous #section (if any)
                  // - the previous #chapter (if any)
                  // Close indent folds for whichever container was active
                  closeIndentStackAt(ln - 1);

                  // Close previous containers
                  if (lastSectionLine !== -1) addRange(lastSectionLine, ln - 1);
                  if (lastChapterLine !== -1) addRange(lastChapterLine, ln - 1);

                  lastChapterLine = ln;
                  lastSectionLine = -1;
                  setActiveContainer(ln);
                  continue;
                }

                if (isSection[ln]) {
                  // #section starts a new nested container.
                  // It closes the previous section (but not the chapter).
                  closeIndentStackAt(ln - 1);

                  if (lastSectionLine !== -1) addRange(lastSectionLine, ln - 1);
                  lastSectionLine = ln;
                  setActiveContainer(ln);
                  continue;
                }

                // Not inside any container => we don't create indentation folds at all.
                if (activeContainerStart === -1) continue;
                if (ln <= activeContainerStart) continue;
                if (ln > activeContainerEnd) continue;

                // Blank lines are ignored for indentation decisions.
                if (isEmpty[ln]) continue;

                lastNonEmptyInContainer = ln;

                const curIndent = indent[ln];

                // If indentation decreased (or stayed the same), we close any deeper/equal folds.
                while (indentStack.length > 0 && curIndent <= indentStack[indentStack.length - 1].indent) {
                  const top = indentStack.pop();
                  addRange(top.startLine, lastNonEmptyInContainer);
                }

                // Open a fold if the next non-empty line is more indented than the current line.
                // This matches how indentation folding is typically derived.
                const nn = nextNonEmpty[ln];
                if (!nn) continue;
                if (nn > activeContainerEnd) continue;

                const nextIndent = indent[nn];
                if (nextIndent > curIndent) {
                  indentStack.push({ indent: curIndent, startLine: ln });
                }
              }

              // Close open indent folds and containers at EOF
              closeIndentStackAt(n);
              if (lastSectionLine !== -1) addRange(lastSectionLine, n);
              if (lastChapterLine !== -1) addRange(lastChapterLine, n);

              // De-dupe + sort (Monaco folding UI behaves better with sorted ranges)
              const seen = new Set();
              const deduped = [];
              for (const r of ranges) {
                const key = `${r.start}:${r.end}`;
                if (seen.has(key)) continue;
                seen.add(key);
                deduped.push(r);
              }

              deduped.sort((a, b) => (a.start - b.start) || (a.end - b.end));
              return deduped;
            }
          });
          return () => {
            foldingProvider.dispose();
          };
        }}
        beforeMount={(monaco) => {
          // Create a theme that matches vs-dark but uses a transparent editor background.
          monaco.editor.defineTheme('scribefold-transparent-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
              // Remove the blue focus border and the current-line border/highlight.
              'focusBorder': '#00000000',
              'editor.lineHighlightBorder': '#00000000',
              'editor.lineHighlightBackground': '#00000000',
              'editor.hoverHighlightBackground': '#00000000',

              // Remove selection / occurrence / "clicked word" highlights.
              'editor.selectionHighlightBackground': '#00000000',
              'editor.selectionHighlightBorder': '#00000000',
              'editor.wordHighlightBackground': '#00000000',
              'editor.wordHighlightBorder': '#00000000',
              'editor.wordHighlightStrongBackground': '#00000000',
              'editor.wordHighlightStrongBorder': '#00000000',
              'editor.symbolHighlightBackground': '#00000000',
              'editor.symbolHighlightBorder': '#00000000',

              // Ensure the real Monaco caret is visible.
              'editorCursor.foreground': '#FFFFFF',

              'editor.background': '#00000000',
              'editorGutter.background': '#00000000',
              'minimap.background': '#00000000',
            },
          });
        }}
        theme="scribefold-transparent-dark"
        onChange={handleChange}
        options={{
          // Line number gutter.
          lineNumbers: settingsObject?.showMonacoLineNumbers ? 'on' : 'off',

          // Disable autocomplete / suggestion popups (word suggestions, etc).
          // This is a writing editor, not a code editor.
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          wordBasedSuggestions: 'off',
          parameterHints: { enabled: false },
          acceptSuggestionOnEnter: 'off',
          tabCompletion: 'off',
          snippetSuggestions: 'none',

          // Sticky top bar / sticky scroll.
          stickyScroll: { enabled: Boolean(settingsObject?.monacoStickyTopBar) },

          // Right-side overview/minimap.
          minimap: { enabled: Boolean(settingsObject?.showPreviewBar) },
          overviewRulerLanes: settingsObject?.showPreviewBar ? 3 : 0,
          overviewRulerBorder: false,

          // Remove the focused/hovered line styling.
          renderLineHighlight: 'none',
          renderLineHighlightOnlyWhenFocus: false,

          // Remove "click word" / occurrences / selection highlight overlays.
          selectionHighlight: false,
          occurrencesHighlight: 'off',
          
          // Folding controls
          folding: true,
          foldingStrategy: 'auto',
          showFoldingControls: 'always',
          
          glyphMargin: true,
          lineNumbersMinChars: 3,

          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
    </div>
  );
}