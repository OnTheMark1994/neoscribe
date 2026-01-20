import React, { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { foldGutter, foldService, codeFolding } from '@codemirror/language';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { EditorView, gutter, lineNumbers } from '@codemirror/view';
import { GutterMarker } from '@codemirror/gutter';
import { unifiedMergeView } from '@codemirror/merge';
import { v4 as uuidv4 } from 'uuid';

// Your icon images (adjust paths if needed)
import AiShowIcon from './scribefold-ai-eye.png';
import AiHideIcon from './scribefold-ai-eye-grey.png';
import AiGreyIcon from './scribefold-ai-eye-grey.png';

// AI Share Gutter Marker
class AiShareMarker extends GutterMarker {
  constructor(status, lineNumber) {
    super();
    this.status = status; // 'show' | 'hide' | 'grey'
    this.lineNumber = lineNumber;
  }

  toDOM() {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.height = '100%';
    div.style.width = '20px';
    
    const img = document.createElement('img');
    img.src = this.status === 'show' ? AiShowIcon :
              this.status === 'hide' ? AiHideIcon : AiGreyIcon;
    img.style.width = '16px';
    img.style.height = '16px';
    img.style.cursor = 'pointer';
    img.title = this.status === 'grey' ? 'Hidden by parent chapter' : `AI Share: ${this.status}`;
    img.onclick = (e) => {
      e.stopPropagation();
      // We'll handle this in the gutter click handler instead
    };
    div.appendChild(img);
    return div;
  }

  eq(other) {
    return other instanceof AiShareMarker && 
           other.status === this.status && 
           other.lineNumber === this.lineNumber;
  }
}

// Effects for metadata
const toggleAiShare = StateEffect.define(); // value: lineNumber
const initLineMeta = StateEffect.define();   // value: array of {lineNum, id, aiShare}

// Store metadata in a separate field
const lineMetaField = StateField.define({
  create() { return new Map(); },
  update(metaMap, tr) {
    let newMap = new Map(metaMap);
    
    for (const eff of tr.effects) {
      if (eff.is(initLineMeta)) {
        if (Array.isArray(eff.value)) {
          eff.value.forEach(item => newMap.set(item.lineNum, { 
            id: item.id, 
            aiShare: item.aiShare 
          }));
        } else {
          newMap.set(eff.value.lineNum, { 
            id: eff.value.id, 
            aiShare: eff.value.aiShare 
          });
        }
      } else if (eff.is(toggleAiShare)) {
        const ln = eff.value;
        if (newMap.has(ln)) {
          const cur = newMap.get(ln);
          newMap.set(ln, { 
            ...cur, 
            aiShare: cur.aiShare === 'show' ? 'hide' : 'show' 
          });
        }
      }
    }
    
    return newMap;
  }
});

// Custom AI gutter – shows icons only on #chapter and #section lines
const aiShareGutter = gutter({
  lineMarker(view, line) {
    const lineNum = view.state.doc.lineAt(line.from).number;
    const metaMap = view.state.field(lineMetaField);
    
    if (!metaMap.has(lineNum)) return null;

    const text = view.state.doc.lineAt(line.from).text;
    if (!text.trimStart().startsWith('#chapter') && !text.trimStart().startsWith('#section')) {
      return null;
    }

    let status = metaMap.get(lineNum).aiShare;

    // Detect if inside a hidden chapter → show grey icon
    if (status === 'show') {
      let inHidden = false;
      for (let i = 1; i < lineNum; i++) {
        const prevLine = view.state.doc.line(i);
        if (prevLine.text.trimStart().startsWith('#chapter')) {
          if (metaMap.get(i)?.aiShare === 'hide') {
            inHidden = true;
            break;
          }
        }
      }
      if (inHidden) status = 'grey';
    }

    return new AiShareMarker(status, lineNum);
  },
  domEventHandlers: {
    mousedown(event, view) {
      const target = event.target;
      if (target.tagName === 'IMG' && target.closest('.cm-gutterElement')) {
        const gutterElement = target.closest('.cm-gutterElement');
        const lineElement = gutterElement.closest('.cm-line');
        if (lineElement) {
          const linePos = view.lineBlockAtHeight(lineElement.getBoundingClientRect().top + 1);
          const line = view.state.doc.lineAt(linePos.from);
          const lineNum = line.number;
          
          view.dispatch({ effects: toggleAiShare.of(lineNum) });
          return true;
        }
      }
      return false;
    }
  },
  class: 'cm-ai-gutter'
});

// Custom folding for #chapter and #section - REPLACE the built-in fold gutter
const headingFoldExtension = (() => {
  // Define fold ranges
  const computeFoldRanges = (state) => {
    const ranges = [];
    const doc = state.doc;
    
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const text = line.text.trimStart();
      
      if (!text.startsWith('#chapter') && !text.startsWith('#section')) continue;

      const level = text.startsWith('#chapter') ? 1 : 2;
      const foldFrom = line.to;

      let foldTo = doc.length;
      
      // Find the next heading at the same or higher level
      for (let j = i + 1; j <= doc.lines; j++) {
        const nextLine = doc.line(j);
        const nextText = nextLine.text.trimStart();
        
        if (nextText.startsWith('#chapter') || nextText.startsWith('#section')) {
          const nextLevel = nextText.startsWith('#chapter') ? 1 : 2;
          if (nextLevel <= level) {
            foldTo = nextLine.from;
            break;
          }
        }
      }
      
      if (foldTo > foldFrom) {
        ranges.push({ from: foldFrom, to: foldTo });
      }
    }
    
    return ranges;
  };

  // Create a custom fold service
  const customFoldService = foldService.of((state, lineStart, lineEnd) => {
    const ranges = computeFoldRanges(state);
    const result = [];
    
    for (const range of ranges) {
      if (range.from >= lineStart && range.from < lineEnd) {
        result.push({
          from: range.from,
          to: range.to
        });
      }
    }
    
    return result.length > 0 ? result : null;
  });

  return customFoldService;
})();

// Combined fold gutter with custom styling
const customFoldGutter = foldGutter({
  markerDOM: (open) => {
    const span = document.createElement('span');
    span.className = 'cm-foldGutterElement';
    span.textContent = open ? '▼' : '▶';
    span.style.cursor = 'pointer';
    span.style.fontSize = '12px';
    span.style.padding = '0 4px';
    return span;
  }
});

// Add CSS for the gutter - REMOVE the min-width
const gutterStyles = EditorView.baseTheme({
  ".cm-gutters": {
    display: "flex",
    backgroundColor: "var(--cm-gutter-background)",
    borderRight: "1px solid var(--cm-gutter-border)"
  },
  ".cm-gutter": {
    display: "flex !important",
    flexDirection: "column",
    flexShrink: 0,
    overflow: "hidden",
    boxSizing: "border-box",
    minHeight: "100%",
    backgroundColor: "inherit"
  },
  ".cm-gutterElement": {
    display: "flex !important",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 2px",
    lineHeight: "normal",
    height: "100%",
    boxSizing: "border-box"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 6px",
    minWidth: "20px",
    justifyContent: "flex-end"
  },
  ".cm-ai-gutter .cm-gutterElement": {
    padding: "0",
    minWidth: "20px"
  },
  ".cm-foldGutter .cm-gutterElement": {
    padding: "0",
    minWidth: "16px"
  }
});

const initialDoc = `#chapter Introduction
This is the intro chapter.

#section Background
Some background info.

#section Methods
Detailed methods.

#chapter Results
Here are the results.

#section Data Analysis
Analysis details.`;

export default function EditorCodeMirror() {
  const [value, setValue] = useState(initialDoc);
  const [original, setOriginal] = useState(null);
  const [diffMode, setDiffMode] = useState(false);
  const [editorView, setEditorView] = useState(null);

  const initializeMetadata = useCallback((view) => {
    const effects = [];
    const doc = view.state.doc;
    
    const lineMetaArray = [];
    
    for (let i = 1; i <= doc.lines; i++) {
      lineMetaArray.push({
        lineNum: i,
        id: uuidv4(),
        aiShare: 'show'
      });
    }
    
    effects.push(initLineMeta.of(lineMetaArray));
    
    view.dispatch({ effects });
  }, []);

  const handleSendToAI = () => {
    if (!editorView) return;
    
    const metaMap = editorView.state.field(lineMetaField);
    const doc = editorView.state.doc;
    
    // Collect data including id and ai-share state
    const aiShareData = [];
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const meta = metaMap.get(i);
      if (meta) {
        aiShareData.push({
          lineNumber: i,
          lineText: line.text,
          id: meta.id,
          aiShare: meta.aiShare,
          isChapter: line.text.trimStart().startsWith('#chapter'),
          isSection: line.text.trimStart().startsWith('#section')
        });
      }
    }
    
    console.log('Sending to AI with share data:', aiShareData);
    
    // Mock AI suggestion
    const mockSuggestion = `#chapter Introduction
Revised introduction with improved clarity.

#section Background
Updated with latest research.

#section Methods
Clearer methodology.

#chapter Results
Stronger findings presented.

#section Data Analysis
New insights and visualizations.`;

    setOriginal(value);
    setValue(mockSuggestion);
    setDiffMode(true);
  };

  const baseExtensions = [
    markdown(),
    gutterStyles,
    // Gutters in order from left to right
    aiShareGutter,
    customFoldGutter,  // Use custom fold gutter
    lineNumbers(),
    codeFolding(),
    headingFoldExtension,
    lineMetaField,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setValue(update.state.doc.toString());
        
        // Reinitialize metadata when document structure changes
        const addedOrRemovedLines = update.changes.newLength !== update.startState.doc.length;
        if (addedOrRemovedLines && update.view) {
          setTimeout(() => initializeMetadata(update.view), 0);
        }
      }
    })
  ];

  const extensions = diffMode && original
    ? [...baseExtensions, unifiedMergeView({ 
        original: EditorState.create({ 
          doc: original,
          extensions: [markdown(), lineNumbers()]
        }),
        revertControls: "before"
      })]
    : baseExtensions;

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>      
      <div style={{ marginBottom: '12px' }}>
        <button onClick={handleSendToAI} disabled={diffMode}>
          Send to AI for Suggestions
        </button>
        {diffMode && (
          <button onClick={() => { setDiffMode(false); setOriginal(null); }} style={{ marginLeft: '10px' }}>
            Exit Review Mode
          </button>
        )}
      </div>

      <CodeMirror
        value={value}
        height="80vh"
        extensions={extensions}
        onCreateEditor={(view) => {
          setEditorView(view);
          initializeMetadata(view);
        }}
        onChange={(newValue) => {
          setValue(newValue);
        }}
      />

      <div style={{ marginTop: '12px', fontSize: '0.9em', color: '#666' }}>
        <p><strong>Features:</strong></p>
        <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
          <li>Click eye icons on chapter/section lines to toggle AI sharing</li>
          <li>Grey eye = hidden because parent chapter is hidden</li>
          <li>Fold chapters/sections hierarchically with gutter arrows</li>
          <li>Indent-based folding also enabled</li>
          <li>Diff mode includes accept/reject buttons</li>
        </ul>
        <p style={{ marginTop: '8px' }}>
          <button 
            onClick={() => {
              if (editorView) {
                const metaMap = editorView.state.field(lineMetaField);
                console.log('Current AI Share State:', Array.from(metaMap.entries()));
              }
            }}
            style={{ fontSize: '0.8em', padding: '2px 8px' }}
          >
            Log AI Share State
          </button>
        </p>
      </div>
    </div>
  );
}