/*
 
 
  */
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { openRightClickWindow } from '../../../Global/ReduxSlices/WindowSlice';
import { setModified } from '../../../Global/ReduxSlices/EditorSlice';
import Editor from '@monaco-editor/react';
import PerformanceTest from './PerformanceTest';
import './EditorMonaco.css';
import { getLinesArrayWithAssertedIds, createLineMetadataDecoration, getLineMetadataFromDecorations, getSectionIcon, getSectionHoverMessage } from './MonacoFunctions';
import { DiffEditor } from '@monaco-editor/react';


export default function EditorMonacoDiff({ monacoEditorRef }) {
  const dispatch = useDispatch();

  // User preferences that should affect Monaco rendering.
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const filepath = useSelector(state => state.editorSlice.filepath);

  // Keeping settings object in a ref so the monaco functions can access it 
  const settingsObjectRef = useRef()
  useEffect(() => {
    settingsObjectRef.current = settingsObject
  }, [settingsObject]);

  // Re check for ai share icons on enter press (in case a new chapter or section has been added or removed)
  useEffect(() => {
      const handleKeypress = (e) => {
        if(e.key === "Enter")
          monacoEditorRef.current?.updateDecorations()
          monacoEditorRef.current?.updateAcceptRejectButtons2()

      };
      document.addEventListener('keypress', handleKeypress);
      return () => document.removeEventListener('mousedown', handleKeypress);
  }, []);

  // Show/hide AI icons when settings.aiModeActive changes
  useEffect(()=>{
    monacoEditorRef.current?.updateDecorations()
  },[settingsObject?.aiModeActive])

  const decorationsRef = useRef(null);

  // This is for initial file load on start so the glyphs show in that case
  const firstChangeRef = useRef(true)
  function handleChange(){
    // So we know if a save is needed (for onclose unsaved changes alert, * on filename)
    dispatch(setModified(true));
    if(!firstChangeRef.current) return
    firstChangeRef.current = false
    monacoEditorRef.current?.updateDecorations()
  }

  // When a new file is loaded (file => open) we updateDecorations we check to render glpyhs 
  useEffect(()=>{
    monacoEditorRef.current?.updateDecorations()
  },[filepath])


  const originalContent = `
    hello
    #chapter
    chapter stuff
    #section
    section stuff
    section stuff 2
  `
  const modifiedContent = `
    hello
    #chapter
    chapter stuff
    #section
    section stuff
    section stuff 2 modified!
  `

  return (
    <div className="editorMonacoContainer">
      {/* <PerformanceTest 
        editorRef={monacoEditorRef} 
        onClose={() => setShowPerformanceTest(false)}
      /> */}
      <DiffEditor
        height="100%"
        defaultLanguage="plaintext"
        defaultValue=""

        original={originalContent}
        modified={modifiedContent}

        onMount={(diffEditor, monaco) => {
            const modifiedEditor = diffEditor.getModifiedEditor();
            if (monacoEditorRef) {
                monacoEditorRef.current = diffEditor;
            }

            const checkIfLineHasAIChanges = (lineNumber) => {
            // Get diff information from Monaco's diff editor
            const diff = modifiedEditor.getModel()?.getAllDecorations();
            
            // Look for diff decorations on this line
            const lineDecorations = diff?.filter(d => 
                d.range.startLineNumber <= lineNumber && 
                d.range.endLineNumber >= lineNumber
            );
            
            // Check if any decoration indicates AI change
            return lineDecorations?.some(d => 
                d.options.className?.includes('diff-modified') || 
                d.options.className?.includes('diff-added') ||
                d.options.className?.includes('diff-removed')
            ) || false;
            };

          // This is here so it can be called with the editor ref
          const updateDecorations = () => {

            // Get the model from the editor (we need it to get the lines etc)
            const model = modifiedEditor.getModel();
            if (!model) return;
            
            // 
            decorationsRef.current = modifiedEditor.deltaDecorations(decorationsRef.current || [], []);
            
            // If ai mode is not on don't add the glyphs
            if (!settingsObjectRef.current?.aiModeActive) return;

            // Get the lines from the model so we can cycle through them
            const lines = model.getLinesContent();
            const newDecorations = [];
            
            // Track the current chapter's hidden state
            let currentChapterHidden = false;
            
            // Go through each line to see which glyph should be added (based on it and what came before it)
            lines.forEach((line, index) => {
              // We use this to get the decorations
              const lineNumber = index + 1;
              const trimmed = line.trim();
              
                // Testing using glyphs for accept/reject changes
                // newDecorations.push({
                //     range: new monaco.Range(lineNumber, 2, lineNumber, 2),
                //     options: {
                //     //   inlineClassName: 'scribefold-chapter-line',
                //     glyphMarginClassName: "scribefold-accept-glyph",
                //     //   glyphMarginHoverMessage: { value: hoverMessage },
                //     stickiness: 1 /* NeverGrowsWhenTypingAtEdges */
                //     }
                // });

                // For the chapter and section glyphs:

              // If its not a chapter or section we don't need to do anythin to it so return
              if (!trimmed.startsWith('#chapter') && !trimmed.startsWith('#section')) {
                return;
              }   
              
              // Get the "decorations" (meta data) for this line
              const lineDecorations = model.getLineDecorations(lineNumber); // getLineDecorations seems to be a monaco default function
              const metadata = getLineMetadataFromDecorations(lineDecorations) || {};
              const isHidden = metadata.aiShare === 'hide';
              
              // Check to see if its a section (starts with #section)
              const isSection = trimmed.startsWith('#section');
              
              // If its not a section its a chapter, so we set the currentChapterHidden flag for this and further lines
              if (!isSection) {
                // Update current chapter state
                currentChapterHidden = isHidden;
              }
              
              // Get the correct icon class and hover message based on variables
              const iconClass = getSectionIcon(isSection, isHidden, currentChapterHidden);
              const hoverMessage = getSectionHoverMessage(isSection, isHidden, currentChapterHidden);
              
              // Push the decoration onto the array of decorations to add
              newDecorations.push({
                range: new monaco.Range(lineNumber, 1, lineNumber, line.length+1),
                options: {
                  inlineClassName: isSection ? 'scribefold-section-line':'scribefold-chapter-line',
                  glyphMarginClassName: iconClass,
                  glyphMarginHoverMessage: { value: hoverMessage },
                  stickiness: 1 /* NeverGrowsWhenTypingAtEdges */
                }
              });
              // newDecorations.push({
              //   range: new monaco.Range(lineNumber, 1, lineNumber, line.length+1),
              //   options: {
              //   }
              // });
            });
            
            // Put them into the editor's decorations 
            decorationsRef.current = modifiedEditor.deltaDecorations(decorationsRef.current || [], newDecorations);
          };
          // Attach this function to the editor ref so it can be accessed anywher ehte editor ref is
          monacoEditorRef.current.updateDecorations = updateDecorations
          // Initial decoration update
          updateDecorations();


            // TODO: Do we need these? 
            monacoEditorRef.current.acceptRejectWidgetIds = [];
            monacoEditorRef.current.acceptRejectZoneIds = [];
            monacoEditorRef.current.acceptRejectOverlayIds = [];

            // This may be called more frequently than update decs, maybe after 500ms of no typing or on other actions like ai chat reponse coming in 
            const updateAcceptRejectButtons = () => {

              const model = modifiedEditor.getModel();
              if (!model) return;

              const lineCount = model.getLineCount();

              // Clear existing view zones and overlay widgets
              if (monacoEditorRef.current.acceptRejectZoneIds) {
                  modifiedEditor.changeViewZones(accessor => {
                  monacoEditorRef.current.acceptRejectZoneIds.forEach(id => accessor.removeZone(id));
                  });
              }
              if (monacoEditorRef.current.acceptRejectOverlayIds) {
                  monacoEditorRef.current.acceptRejectOverlayIds.forEach(id => {
                  modifiedEditor.removeOverlayWidget(id.widget);
                  });
              }
              monacoEditorRef.current.acceptRejectZoneIds = [];
              monacoEditorRef.current.acceptRejectOverlayIds = [];

              // For testing: every 4th line (replace with real diff hunk detection later)
              for (let lineNumber = 4; lineNumber <= lineCount; lineNumber += 4) {
                  // 1. Create a transparent view zone to push content down
                  const zoneDom = document.createElement('div');
                  zoneDom.style.height = '40px'; // Adjust to fit your buttons + padding
                  zoneDom.style.width = '100%';
                  // Optional: add background or border for debugging
                  // zoneDom.style.background = 'rgba(0,0,255,0.1)';

                  const viewZone = {
                  afterLineNumber: lineNumber,
                  heightInPx: 40, // Use px for precise control
                  domNode: zoneDom,
                  // suppressMouseDown: false // Allow clicks to pass if needed, but we handle in overlay
                  };

                  let zoneId;
                  modifiedEditor.changeViewZones(accessor => {
                  zoneId = accessor.addZone(viewZone);
                  });
                  monacoEditorRef.current.acceptRejectZoneIds.push(zoneId);

                  // 2. Create the clickable overlay widget (buttons)
                  const overlayDom = document.createElement('div');
                  overlayDom.className = 'accept-reject-widget-line';
                  overlayDom.innerHTML = `
                  <div class="accept-reject-widget">
                      <button class="accept-reject-btn reject-btn">Reject</button>
                      <button class="accept-reject-btn accept-btn">Accept</button>
                  </div>
                  `;

                  // Click handler - fully interactive!
                  overlayDom.addEventListener('click', (e) => {
                  e.stopPropagation();
                  const button = e.target.closest('.accept-reject-btn');
                  if (!button) return;

                  if (button.classList.contains('accept-btn')) {
                      console.log('Accept clicked for hunk after line', lineNumber);
                      // TODO: implement accept logic (apply changes to original)
                  } else {
                      console.log('Reject clicked for hunk after line', lineNumber);
                      // TODO: implement reject logic (revert changes)
                  }
                  });

                  const overlayWidget = {
                  getId: () => `accept.reject.overlay.${lineNumber}`,
                  getDomNode: () => overlayDom,
                  getPosition: () => null, // Overlay widgets ignore position - we position manually below
                  allowEditorOverflow: false
                  };

                  modifiedEditor.addOverlayWidget(overlayWidget);

                  // 3. Position the overlay exactly on top of the view zone
                  // This callback fires whenever layout changes (scroll, resize, etc.)
                  viewZone.onDomNodeTop = (top) => {
                  overlayDom.style.position = 'absolute';
                  overlayDom.style.top = `${top}px`;
                  overlayDom.style.left = '0px'; // Or adjust for line numbers gutter
                  overlayDom.style.width = '100%';
                  };

                  // Initial layout
                  modifiedEditor.layoutOverlayWidget(overlayWidget);

                  monacoEditorRef.current.acceptRejectOverlayIds.push({ line: lineNumber, widget: overlayWidget });
              }

              console.log(`Added ${monacoEditorRef.current.acceptRejectZoneIds.length} accept/reject zones + overlays`);
            };

            monacoEditorRef.current.updateAcceptRejectButtons = updateAcceptRejectButtons;
            // updateAcceptRejectButtons()

            const updateAcceptRejectButtons2 = () => {

              const model = modifiedEditor.getModel();
              if (!model) return;

              const lineChanges = diffEditor.getLineChanges(); // <-- This is the key!

              if (!lineChanges || lineChanges.length === 0) {
                console.log('No differences detected');
                return;
              }

                // Clear existing view zones and overlay widgets
              if (monacoEditorRef.current.acceptRejectZoneIds) {
                  modifiedEditor.changeViewZones(accessor => {
                  monacoEditorRef.current.acceptRejectZoneIds.forEach(id => accessor.removeZone(id));
                  });
              }
              if (monacoEditorRef.current.acceptRejectOverlayIds) {
                  monacoEditorRef.current.acceptRejectOverlayIds.forEach(id => {
                  modifiedEditor.removeOverlayWidget(id.widget);
                  });
              }
              monacoEditorRef.current.acceptRejectZoneIds = [];
              monacoEditorRef.current.acceptRejectOverlayIds = [];

              // Go through each line and add if necessary
              lineChanges.forEach(change => {
                // We place the buttons AFTER the modified hunk
                // If lines were deleted only (modifiedEndLineNumber === 0), place after originalEndLineNumber
                let afterLineNumber;
                if (change.modifiedEndLineNumber === 0) {
                  // Pure deletion – place after the deleted block in original
                  afterLineNumber = change.originalEndLineNumber;
                } else {
                  // Addition or modification – place after the last modified line
                  afterLineNumber = change.modifiedEndLineNumber;
                }

              // 1. Create a transparent view zone to push content down
                  const zoneDom = document.createElement('div');
                  zoneDom.style.height = '40px'; // Adjust to fit your buttons + padding
                  zoneDom.style.width = '100%';
                  // Optional: add background or border for debugging
                  // zoneDom.style.background = 'rgba(0,0,255,0.1)';

                  const viewZone = {
                    afterLineNumber: afterLineNumber,
                    heightInPx: 40, // Use px for precise control
                    domNode: zoneDom,
                    // suppressMouseDown: false // Allow clicks to pass if needed, but we handle in overlay
                  };

                  let zoneId;
                  modifiedEditor.changeViewZones(accessor => {
                  zoneId = accessor.addZone(viewZone);
                  });
                  monacoEditorRef.current.acceptRejectZoneIds.push(zoneId);

                  // 2. Create the clickable overlay widget (buttons)
                  const overlayDom = document.createElement('div');
                  overlayDom.className = 'accept-reject-widget-line';
                  overlayDom.innerHTML = `
                  <div class="accept-reject-widget">
                      <button class="accept-reject-btn reject-btn">Reject</button>
                      <button class="accept-reject-btn accept-btn">Accept</button>
                  </div>
                  `;

                  // Click handler - fully interactive!
                  overlayDom.addEventListener('click', (e) => {
                  e.stopPropagation();
                  const button = e.target.closest('.accept-reject-btn');
                  if (!button) return;

                  if (button.classList.contains('accept-btn')) {
                      console.log('Accept clicked for hunk after line', afterLineNumber);
                      // TODO: implement accept logic (apply changes to original)
                  } else {
                      console.log('Reject clicked for hunk after line', afterLineNumber);
                      // TODO: implement reject logic (revert changes)
                  }
                  });

                  const overlayWidget = {
                    getId: () => `accept.reject.overlay.${afterLineNumber}`,
                    getDomNode: () => overlayDom,
                    getPosition: () => null, // Overlay widgets ignore position - we position manually below
                    allowEditorOverflow: false
                  };

                  modifiedEditor.addOverlayWidget(overlayWidget);

                  // 3. Position the overlay exactly on top of the view zone
                  // This callback fires whenever layout changes (scroll, resize, etc.)
                  viewZone.onDomNodeTop = (top) => {
                  overlayDom.style.position = 'absolute';
                  overlayDom.style.top = `${top}px`;
                  overlayDom.style.left = '0px'; // Or adjust for line numbers gutter
                  overlayDom.style.width = '100%';
                  };

                  // Initial layout
                  modifiedEditor.layoutOverlayWidget(overlayWidget);

                  monacoEditorRef.current.acceptRejectOverlayIds.push({ line: afterLineNumber, widget: overlayWidget });

              })

              const lineCount = model.getLineCount();

            };

            monacoEditorRef.current.updateAcceptRejectButtons2 = updateAcceptRejectButtons2;
            updateAcceptRejectButtons2()




          // When glyph is clicked it toggles metadata. This is here so it can be called with the editor ref
          const toggleAiShareForLine = (lineNumber) => {
            const model = modifiedEditor.getModel();
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

            modifiedEditor.deltaDecorations(oldDecorationIds, [newDecoration]);
            modifiedEditor.layout();
            updateDecorations();
          };
          modifiedEditor.toggleAiShareForLine = toggleAiShareForLine
          
          // Handle mouse clicks on monaco (to toggle aiShare metadata on click)
          modifiedEditor.onMouseDown((e) => {
            if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
              return;
            }

            if(e.event.rightButton){
                e.event.preventDefault(); // THIS prevents browser context menu
                e.event.stopPropagation();

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
              
  
              const position = e.target.position;
              if (!position || !position.lineNumber) {
                console.log('[DEBUG] Missing position/lineNumber');
                return;
              }
              
              const lineNumber = position.lineNumber;
              toggleAiShareForLine(lineNumber);
              
            }
          });

          // Preventing browser right click menu on glyph right click
          window.addEventListener('contextmenu', (e) => {
            // if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
            if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
              return;
            }
            e.preventDefault(); // THIS stops the browser menu
          
          }, true);

          // Create a language register? trying to change section and chapter font 
          // monaco.languages.register({ id: 'scribefold' });
          // monaco.languages.setMonarchTokensProvider('scribefold', {
          //     tokenizer: {
          //       root: [
          //         // Match #chapter at start of line (with optional whitespace)
          //         [/^\s*#chapter\b/, 'scribefold.chapter'],
                  
          //         // Match #section at start of line (with optional whitespace)
          //         [/^\s*#section\b/, 'scribefold.section'],
                  
          //         // Default token
          //         [/.+/, '']
          //       ]
          //     }
          //   });

          // Folding ranges for the chapter and section (and indent)
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
        // Creating a theme before mount
        beforeMount={(monaco) => {
          // Create a theme that matches vs-dark but uses a transparent editor background.
          monaco.editor.defineTheme('scribefold-transparent-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              
            ],
            colors: {
              'editor.foreground': "#00000000",
              'editor.scribefold-section-line.foreground': "rgba(11, 46, 203, 0)",
              'editor.scribefold-section-line.foreground': "blue",

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