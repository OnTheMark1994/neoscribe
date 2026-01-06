export function getEditorText(editorRef) {
  const view = editorRef?.current;
  if (!view?.state?.doc) return '';
  return view.state.doc.toString();
}

export function setEditorText(editorRef, content) {
  const view = editorRef?.current;
  if (!view?.dispatch || !view?.state?.doc) return false;

  const next = String(content ?? '');
  const current = view.state.doc.toString();
  if (next === current) return true;

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next },
  });
  return true;
}

export function backspaceAtCursor(editorRef) {
  const view = editorRef?.current;
  if (!view?.dispatch || !view?.state) return false;

  const sel = view.state.selection.main;
  const from = sel.from;
  const to = sel.to;
  if (from !== to) {
    view.dispatch({ changes: { from, to, insert: '' } });
    view.focus?.();
    return true;
  }

  if (from === 0) return true;
  view.dispatch({ changes: { from: from - 1, to: from, insert: '' } });
  view.focus?.();
  return true;
}

const AI_HIDDEN_MARKER = '\u200C';

export function getAIVisibleLinesFromEditor(editorRef) {
  const text = getEditorText(editorRef);
  const lines = String(text ?? '').split('\n');

  return lines.map((line, idx) => {
    const isHidden = String(line).endsWith(AI_HIDDEN_MARKER);
    const content = isHidden ? String(line).slice(0, -1) : String(line);
    return {
      lineId: `line_${idx + 1}`,
      content,
      aiShare: isHidden ? 'hide' : 'show',
    };
  });
}

export function focusEditor(editorRef) {
  const view = editorRef?.current;
  if (!view?.focus) return false;
  view.focus();
  return true;
}

export function insertTextAtCursor(editorRef, text) {
  const view = editorRef?.current;
  if (!view?.dispatch || !view?.state) return false;

  const insert = String(text ?? '');
  const { from, to } = view.state.selection.main;
  view.dispatch({ changes: { from, to, insert } });
  view.focus?.();
  return true;
}
