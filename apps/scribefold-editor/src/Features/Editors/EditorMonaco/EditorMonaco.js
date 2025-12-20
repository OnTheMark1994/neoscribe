/*
 
 
  */
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { openRightClickWindow } from '../../../Global/ReduxSlices/WindowSlice';
import Editor from '@monaco-editor/react';
import PerformanceTest from './PerformanceTest';
import './EditorMonaco.css';
import { getLinesArrayWithAssertedIds, createLineMetadataDecoration, getLineMetadataFromDecorations } from './MonacoFunctions';

function assertLineIds(editorRef){
  
  if (!editorRef?.current) {
    console.error('No editor reference');
    return;
  }
  
  const model = editorRef.current.getModel();
  if (!model) {
    console.error('No editor model');
    return;
  }
  
  const lines = model.getLinesContent();
  const linesWithMetadata = lines.map((content, index) => {
    const lineNumber = index + 1;
    return {
      lineNumber,
      content,
      metadata: model.__lineMetadata?.[lineNumber] || {}
    };
  });
  
  // Log lines before making API call
  console.log('Preparing to send to AI - Lines with metadata:', linesWithMetadata);
  
  // Return structured data for API call
  return {
    lines: linesWithMetadata,
    timestamp: new Date().toISOString()
  };
}

function getEditorContentWithMetadata(editorRef) {
  if (!editorRef?.current) {
    console.error('No editor reference');
    return;
  }
  
  const model = editorRef.current.getModel();
  if (!model) {
    console.error('No editor model');
    return;
  }
  
  const lines = model.getLinesContent();
  const linesWithMetadata = lines.map((content, index) => {
    const lineNumber = index + 1;
    return {
      lineNumber,
      content,
      metadata: model.__lineMetadata?.[lineNumber] || {}
    };
  });
  
  // Log lines before making API call
  console.log('Preparing to send to AI - Lines with metadata:', linesWithMetadata);
  
  // Return structured data for API call
  return {
    lines: linesWithMetadata,
    timestamp: new Date().toISOString()
  };
}

export default function EditorMonaco({ monacoEditorRef }) {
  const dispatch = useDispatch();
  // User preferences that should affect Monaco rendering.
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const aiModeActive = useSelector(state => state.settingsSlice.settingsObject?.aiModeActive);
  const proposedChanges = useSelector(state => state.aiSlice.proposedChanges);

  useEffect(() => {
    console.log('[EditorMonaco] proposedChanges updated:', proposedChanges);
  }, [proposedChanges]);

  // This is supposed to update the decorations when the aiModeActive changes but the updateDecorations function is in a different scope
  useEffect(() => {
    if (monacoEditorRef.current) {
      // updateDecorations();
      // monacoEditorRef.current.deltaDecorations(
      //   decorationsRef.current || [],
      //   aiModeActive ? createDecorations(monacoEditorRef.current.getModel()) : []
      // );
    }
  }, [aiModeActive]);

  const initialValue = useMemo(() => {
    return [
      '#chapter Introduction',
      '',
      'This is a basic Monaco editor instance.',
      '',
      '#section Notes',
      '- You can type here.',
    ].join('\n');
  }, []);

  const [showPerformanceTest, setShowPerformanceTest] = useState(false);
  const decorationsRef = useRef(null);

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
        defaultLanguage="markdown"
        defaultValue={initialValue}
        onMount={(editor, monaco) => {
          if (monacoEditorRef) {
            monacoEditorRef.current = editor;
          }

          // Ensure glyph margin is visible
          editor.updateOptions({
            glyphMargin: true,
            lineNumbersMinChars: 3
          });
          
          const updateDecorations = () => {
            const model = editor.getModel();
            if (!model || !aiModeActive) return;
            // if (!model) return;
            
            // Clear existing decorations first
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current || [], []);
            
            const lines = model.getLinesContent();
            const newDecorations = [];
            
            lines.forEach((line, index) => {
              const lineNumber = index + 1;
              const trimmed = line.trim();
              
              if (trimmed.startsWith('#chapter') || trimmed.startsWith('#section')) {
                const lineDecorations = model.getLineDecorations(lineNumber);
                const metadata = getLineMetadataFromDecorations(lineDecorations) || {};
                const isHidden = metadata.aiShare === 'hide';
                
                newDecorations.push({
                  range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                  options: {
                    glyphMarginClassName: isHidden ? 'ai-hide-icon' : 'ai-eye-icon',
                    glyphMarginHoverMessage: { value: isHidden ? 'Hidden from AI' : 'Visible to AI' },
                    stickiness: 1 /* NeverGrowsWhenTypingAtEdges */
                  }
                });
              }
            });
            
            decorationsRef.current = editor.deltaDecorations(decorationsRef.current || [], newDecorations);
          };
          
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
                  dispatch(openRightClickWindow({ 
                    left: x, 
                    top: y,
                    type: 'eyeIcon'
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
              const model = editor.getModel();
              if (!model) {
                console.log('[DEBUG] No editor model');
                return;
              }
              
              // Get existing decorations
              const existingLineDecorations = model.getLineDecorations(lineNumber);
              console.log('[DEBUG] Existing decorations', existingLineDecorations);
              
              const existingMetadata = getLineMetadataFromDecorations(existingLineDecorations) || {};
              console.log('[DEBUG] Existing metadata', existingMetadata);
              
              // Toggle visibility state
              const isHidden = existingMetadata.aiShare === 'hide';
              const newMetadata = {
                ...existingMetadata,
                aiShare: isHidden ? undefined : 'hide'
              };
              
              // Create new decoration
              const newDecoration = createLineMetadataDecoration(lineNumber, newMetadata);
              
              // Clear all metadata decorations for this line first
              const metaDecorations = existingLineDecorations
                .filter(d => d.options.description?.startsWith('sf_meta:'));
              const oldDecorationIds = metaDecorations.map(d => d.id);
              
              // Apply changes
              editor.deltaDecorations(oldDecorationIds, [newDecoration]);
              editor.layout();
              updateDecorations();
              
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
          
          const foldingProvider = monaco.languages.registerFoldingRangeProvider('markdown', {
            provideFoldingRanges: (model) => {
              const lines = model.getLinesContent();
              const ranges = [];
              
              // Track chapters and their sections
              const chapters = [];
              const sections = [];
              
              // First, identify all markers
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const lineNum = i + 1;
                
                if (line.startsWith('#chapter')) {
                  chapters.push({ line: lineNum, index: i });
                } else if (line.startsWith('#section')) {
                  sections.push({ line: lineNum, index: i });
                }
              }
              
              // Create chapter ranges
              for (let i = 0; i < chapters.length; i++) {
                const chapter = chapters[i];
                const nextChapter = chapters[i + 1];
                const endLine = nextChapter ? nextChapter.index : lines.length;
                
                ranges.push({
                  start: chapter.line,
                  end: endLine,
                  kind: monaco.languages.FoldingRangeKind.Region
                });
              }
              
              // Create section ranges (must be within a chapter)
              for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                const nextSection = sections[i + 1];
                const nextChapter = chapters.find(c => c.index > section.index);
                
                // Determine end of this section
                let endLine = lines.length;
                if (nextSection && nextSection.index < (nextChapter?.index || Infinity)) {
                  endLine = nextSection.index;
                } else if (nextChapter) {
                  endLine = nextChapter.index;
                }
                
                ranges.push({
                  start: section.line,
                  end: endLine,
                  kind: monaco.languages.FoldingRangeKind.Region
                });
              }
              
              return ranges;
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
          showFoldingControls: 'always',
          
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
    </div>
  );
}

export {
  getEditorContentWithMetadata
};
