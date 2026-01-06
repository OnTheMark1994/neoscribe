import { foldGutter, codeFolding, foldService } from '@codemirror/language';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

function getLineIndent(text) {
  const match = /^\s*/.exec(text);
  return match ? match[0].length : 0;
}

function indentFoldService(state, lineStart) {
  const startLine = state.doc.lineAt(lineStart);
  const startIndent = getLineIndent(startLine.text);

  let nextLineNumber = startLine.number + 1;
  if (nextLineNumber > state.doc.lines) return null;

  const firstChildLine = state.doc.line(nextLineNumber);
  const firstChildIndent = getLineIndent(firstChildLine.text);
  if (firstChildIndent <= startIndent) return null;

  let endLineNumber = nextLineNumber;
  while (endLineNumber + 1 <= state.doc.lines) {
    const line = state.doc.line(endLineNumber + 1);
    const indent = getLineIndent(line.text);
    if (line.text.trim().length > 0 && indent <= startIndent) break;
    endLineNumber++;
  }

  const endLine = state.doc.line(endLineNumber);
  if (endLine.to <= startLine.to) return null;
  return { from: startLine.to, to: endLine.to };
}

// Build the extension set for a given onChange handler.
export function buildExtensions(onChange, options = {}) {
  const showLineNumbers = !!options.showLineNumbers;
  return [
    // lineNumbers(),
    foldGutter(),
    // codeFolding(),
    foldService.of(indentFoldService),
    keymap.of([indentWithTab]),
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
}

// Create and attach a new EditorView instance.
export function createEditorView({ container, state }) {
  if (!container || !state) return null;
  return new EditorView({
    state,
    parent: container,
  });
}

// Keep the CodeMirror document in sync with an external value.
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
