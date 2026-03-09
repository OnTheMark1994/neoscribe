import { lineIdState } from '../Features/Editors/CodeMirror/EditorSetup';

export function getEditorText(editorRef) {
  const view = editorRef?.current;
  if (!view?.state?.doc) {
    return '';
  }
  const text = view.state.doc.toString();
  return text;
}

export function setEditorText(editorRef, content) {
  const view = editorRef?.current;
  
  if (!view?.dispatch || !view?.state?.doc) {
    return false;
  }

  const next = String(content ?? '');
  const current = view.state.doc.toString();
  
  if (next === current) {
    return true;
  }

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
  const view = editorRef?.current;
  if (!view?.state?.doc) return [];

  const doc = view.state.doc;
  const lineIdMap = view.state.field(lineIdState);

  const result = [];
  let parentChapterHidden = null;
  let parentSectionHidden = null;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    const trimmed = text.trimStart();
    const isChapter = /^#(?:c|chapter)(\s|$)/i.test(trimmed);
    const isSection = /^#(?:s|section)(\s|$)/i.test(trimmed);
    const isExplicitlyHidden = text.endsWith(AI_HIDDEN_MARKER);

    let shouldShare = false;

    // Chapter line
    if (isChapter) {
      parentChapterHidden = isExplicitlyHidden;
      parentSectionHidden = null;
      shouldShare = !isExplicitlyHidden;
    } 
    // Section line
    else if (isSection) {
      parentSectionHidden = isExplicitlyHidden;
      // Section is hidden if parent chapter is hidden OR section is explicitly hidden
      shouldShare = !(parentChapterHidden || isExplicitlyHidden);
    } 
    // All other lines
    else {
      // If the parent chapter or section is hidden hide it 
      if (parentChapterHidden === true || parentSectionHidden === true) {
        shouldShare = false;
      }
      // Else show it
      else{
        shouldShare = true
      }
    }

    if (shouldShare) {
      const lineId = lineIdMap.get(line.from) || `line_${i}`;
      result.push({
        lineId,
        content: text,
      });
    }
  }

  return result;
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

export function getAllLinesWithIds(editorRef) {
  const view = editorRef?.current;
  if (!view?.state?.doc) return [];

  const doc = view.state.doc;
  const lineIdMap = view.state.field(lineIdState);

  const result = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const lineId = lineIdMap.get(line.from) || `line_${i}`;
    result.push({
      lineId,
      content: line.text,
    });
  }

  return result;
}

export function applyProposedChanges(editorRef, proposedChanges) {
  if (!Array.isArray(proposedChanges) || proposedChanges.length === 0) {
    return getEditorText(editorRef);
  }

  const view = editorRef?.current;
  if (!view?.state?.doc) {
    return '';
  }

  const doc = view.state.doc;
  const lineIdMap = view.state.field(lineIdState);

  const originalText = doc.toString();

  // Prepare a simple line list with stable lineIds in document order.
  const originalLines = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const lineId = lineIdMap.get(line.from) || `line_${i}`;
    originalLines.push({ lineId, text: line.text });
  }

  // Normalize and group changes by type / target line.
  const deleteSet = new Set();
  const modifyMap = new Map();
  const insertMap = new Map(); // lineId -> array of strings to insert *after* that line

  for (const rawChange of proposedChanges) {
    if (!rawChange) continue;

    const type = String(rawChange.type || '').toLowerCase();
    const lineID = rawChange.lineID ?? rawChange.lineId;
    if (!lineID) continue;

    if (type === 'delete') {
      deleteSet.add(lineID);
    } else if (type === 'modify') {
      const newText = rawChange.proposedText ?? rawChange.content ?? rawChange.newContent;
      if (typeof newText === 'string') {
        modifyMap.set(lineID, newText);
      }
    } else if (type === 'insert') {
      const linesToInsert = Array.isArray(rawChange.linesToInsert)
        ? rawChange.linesToInsert
        : [];
      if (linesToInsert.length === 0) continue;

      const existing = insertMap.get(lineID) || [];
      insertMap.set(lineID, existing.concat(linesToInsert.map(String)));
    }
  }

  const resultLines = [];

  for (const line of originalLines) {
    const { lineId, text } = line;

    // Apply delete (skip line entirely).
    if (deleteSet.has(lineId)) {
      continue;
    }

    // Apply modify (replace text) or keep original.
    const modifiedText = modifyMap.has(lineId) ? modifyMap.get(lineId) : text;
    resultLines.push(modifiedText);

    // Apply inserts that are anchored to this line (insert *after* it).
    const insertsForLine = insertMap.get(lineId);
    if (Array.isArray(insertsForLine) && insertsForLine.length > 0) {
      for (const insertText of insertsForLine) {
        resultLines.push(insertText);
      }
    }
  }

  const resultText = resultLines.join('\n');

  return resultText;
}
