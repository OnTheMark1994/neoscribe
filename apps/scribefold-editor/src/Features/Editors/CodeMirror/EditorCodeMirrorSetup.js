import { foldGutter, foldService } from '@codemirror/language';
import { EditorView, keymap, gutter, GutterMarker } from '@codemirror/view';
import { StateField, Facet } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
// This is for the default ctrl f search (leave it here for reference) 
import { search, searchKeymap } from '@codemirror/search';
import AiShowIcon from '../../../images/scribefold-ai-eye.png';           // Full color: actively shared
import AiShowGreyIcon from '../../../images/scribefold-ai-eye-grey.png';   // Dimmed: inherited hidden
import AiHideIcon from '../../../images/scribefold-ai-eye-crossed-out.png';   // Explicitly hidden
// import AiHideIcon from '../scribefold-ai-eye-slash.png';      // Explicitly hidden

// Helper: count leading whitespace length
function getLineIndent(text) {
  const match = /^\s*/.exec(text);
  return match ? match[0].length : 0;
}

const customOutlineFolding = (state, lineStart, lineEnd) => {
  const doc = state.doc;
  const startLine = doc.lineAt(lineStart);

  if (startLine.to !== lineEnd) return null;

  const text = startLine.text;
  const trimmed = text.trimStart();

  let foldEndPos = null;

  if (trimmed.startsWith('#chapter') || trimmed.startsWith('#section')) {
    const isChapter = trimmed.startsWith('#chapter');

    let currentLineNum = startLine.number + 1;
    let foundEndLine = null;

    while (currentLineNum <= doc.lines) {
      const line = doc.line(currentLineNum);
      const lineTrimmed = line.text.trimStart();

      if (lineTrimmed.startsWith('#chapter') || 
          (!isChapter && lineTrimmed.startsWith('#section'))) {
        foundEndLine = doc.line(currentLineNum - 1);
        break;
      }
      currentLineNum++;
    }

    foldEndPos = foundEndLine ? foundEndLine.to : doc.length;
  } else {
    const startIndent = getLineIndent(text);

    let nextNonBlankNum = startLine.number + 1;
    while (nextNonBlankNum <= doc.lines && doc.line(nextNonBlankNum).text.trim().length === 0) {
      nextNonBlankNum++;
    }
    if (nextNonBlankNum > doc.lines) return null;

    const nextIndent = getLineIndent(doc.line(nextNonBlankNum).text);
    if (nextIndent <= startIndent) return null;

    let endLineNum = nextNonBlankNum;
    while (endLineNum <= doc.lines) {
      const line = doc.line(endLineNum);
      if (line.text.trim().length > 0 && getLineIndent(line.text) <= startIndent) {
        foldEndPos = doc.line(endLineNum - 1).to;
        break;
      }
      endLineNum++;
    }
    if (!foldEndPos) foldEndPos = doc.length;
  }

  if (foldEndPos && foldEndPos > startLine.to) {
    return { from: startLine.to, to: foldEndPos };
  }
  return null;
};

// Only one invisible marker: explicitly hidden
const AI_HIDDEN_MARKER = '\u200C'; // zero-width non-joiner

// Helper to generate unique line IDs
function generateLineId() {
  return `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// StateField to track stable line IDs
// Maps line positions to unique IDs that persist across edits
const lineIdState = StateField.define({
  create(state) {
    const map = new Map();
    const doc = state.doc;
    
    // Generate IDs for all existing lines
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      map.set(line.from, generateLineId());
    }
    
    return map;
  },
  
  update(value, transaction) {
    if (!transaction.docChanged) return value;

    const newValue = new Map();
    const doc = transaction.state.doc;

    // Single pass: keep existing IDs, generate new ones for new lines
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const existingId = value.get(line.from);
      newValue.set(line.from, existingId || generateLineId());
    }

    return newValue;
  }
});

class AIShareMarker extends GutterMarker {
  constructor(state) {
    super();
    this.state = state; // 'shared' | 'inherited-hidden' | 'explicitly-hidden'
  }

  toDOM(view) {
    const img = document.createElement('img');

    if (this.state === 'explicitly-hidden') {
      img.src = AiHideIcon;
      img.alt = 'Explicitly hidden from AI';
      img.title = 'Hidden';
    } else if (this.state === 'inherited-hidden') {
      img.src = AiShowGreyIcon;
      img.alt = 'Hidden (parent chapter is hidden)';
      img.title = '(parent is hidden)';
    } else {
      // 'shared'
      img.src = AiShowIcon;
      img.alt = 'Shared with AI';
      img.title = 'Shown';
    }

    img.style.width = '16px';
    img.style.height = '16px';
    img.style.cursor = 'pointer';
    img.style.margin = '0 4px';
    img.style.opacity = this.state === 'inherited-hidden' ? '0.6' : '1';

    return img;
  }

  eq(other) {
    return other instanceof AIShareMarker && other.state === this.state;
  }
}

// Simple toggle: only adds/removes the hidden marker
function toggleAIShareMetadata(view, lineStartPos) {
  const line = view.state.doc.lineAt(lineStartPos);
  const text = line.text;

  let newText;

  if (text.endsWith(AI_HIDDEN_MARKER)) {
    // Explicitly hidden → remove marker (back to shared/default)
    newText = text.slice(0, -1);
  } else {
    // Not hidden → explicitly hide
    newText = text + AI_HIDDEN_MARKER;
  }

  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newText },
  });
}

const aiShareGutter = gutter({
  lineMarker(view, lineBlock) {
    const line = view.state.doc.lineAt(lineBlock.from);
    const text = line.text;
    const trimmed = text.trimStart();

    if (!trimmed.startsWith('#chapter') && !trimmed.startsWith('#section')) {
      return null;
    }

    const isExplicitlyHidden = text.endsWith(AI_HIDDEN_MARKER);
    const isChapter = trimmed.startsWith('#chapter');

    // For chapters: simple
    if (isChapter) {
      return new AIShareMarker(isExplicitlyHidden ? 'explicitly-hidden' : 'shared');
    }

    // For sections: explicit marker takes priority over inherited state
    if (isExplicitlyHidden) {
      return new AIShareMarker('explicitly-hidden');
    }

    // Otherwise, check if parent chapter is hidden to show inherited-hidden
    let parentChapterHidden = false;
    let currentLineNum = line.number - 1;

    while (currentLineNum >= 1) {
      const prevLine = view.state.doc.line(currentLineNum);
      const prevTrimmed = prevLine.text.trimStart();
      if (prevTrimmed.startsWith('#chapter')) {
        parentChapterHidden = prevLine.text.endsWith(AI_HIDDEN_MARKER);
        break;
      }
      currentLineNum--;
    }

    if (parentChapterHidden) {
      return new AIShareMarker('inherited-hidden');
    }

    return new AIShareMarker('shared');
  },

  domEventHandlers: {
    mousedown(view, lineBlock, event) {
      const target = event.target;
      if (target && target.tagName === 'IMG') {
        // Left click (button 0) - toggle
        if (event.button === 0) {
          event.preventDefault();
          toggleAIShareMetadata(view, lineBlock.from);
          return true;
        }
        // Right click (button 2) - prevent default but don't toggle
        if (event.button === 2) {
          event.preventDefault();
          return true;
        }
      }
      return false;
    }
  }
});

export { lineIdState };
export function buildExtensions(onChange, aiModeActive, options = {}) {
  const showLineNumbers = !!options.showLineNumbers;
  const spellcheckEnabled = options.spellcheckEnabled !== false;
  const spellcheckExtension = spellcheckEnabled
    ? EditorView.contentAttributes.of({ spellcheck: "true" })
    : null;

  const extensions = [
    ...(spellcheckExtension ? [spellcheckExtension] : []),
    lineIdState,
    ...(aiModeActive ? [aiShareGutter] : []),
    foldGutter({
      markerDOM: (open) => {
        const span = document.createElement('span');
        span.textContent = open ? '▽' : '▷';
        span.title = open ? 'Unfold' : 'Fold';
        span.style.cursor = 'pointer';
        span.style.fontSize = '13px';
        span.style.padding = '0 4px';
        return span;
      }
    }),
    foldService.of(customOutlineFolding),
    keymap.of([indentWithTab]),
    // This is for the default ctrl f search (leave it here for reference) 
    search(),
    keymap.of(searchKeymap),
    EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    '.cm-scroller': {
      backgroundColor: 'transparent',
      flex: 1,
      minHeight: '0',
      overflow: 'auto',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      display: 'flex',
    },
    '.cm-lineNumbers': {
      display: showLineNumbers ? 'block' : 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && typeof onChange === 'function') {
        const doc = update.state.doc.toString();
        onChange(doc);
      }
    }),
  ];

  return extensions;
}

export function createEditorView({ container, state }) {
  if (!container || !state) return null;
  return new EditorView({
    state,
    parent: container,
  });
}

export function syncEditorDoc(view, value) {
  if (!view) return;
  const currentDoc = view.state.doc.toString();
  if (value !== undefined && value !== currentDoc) {
    view.dispatch({
      changes: {
        from: 0,
        to: currentDoc.length,
        insert: value,
      },
    });
  }
}