// Foldable Text Editor Engine
// State: lines array where each entry is {text, open, level, startIdx, endIdx, id, sendToAI}

let lines = [];
let visibleLines = [];

// Generate unique ID for a line
export function generateLineId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'x';
  for (let i = 0; i < 7; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Undo/Redo History
const MAX_HISTORY = 100;
let changeHistory = [];
let historyIndex = -1;
let historyEnabled = true;

// Parse text into lines array
export function parseText(text) {
  const raw = text.split('\n');
  lines = raw.map(t => ({ 
    text: t, 
    open: true, 
    level: 0, 
    startIdx: -1, 
    endIdx: -1,
    sendToAI: 'all',
    id: generateLineId(),
    hidden: false
  }));

  for (let i = 0; i < lines.length; i++) {
    const lineText = (lines[i].text || '').trim();
    let level = 0;
    let isHeader = false;

    if (lineText.match(/^#chapter(?:\s|$)/i)) { 
      level = 1; 
      isHeader = true;
    } else if (lineText.match(/^#section(?:\s|$)/i)) { 
      level = 2; 
      isHeader = true;
    }

    lines[i].level = level;
    lines[i].hidden = false;

    if (isHeader) {
      // Determine AI sharing mode from tags on the header line
      if (lineText.match(/#ai-hide\b/i) || lineText.match(/#aihide\b/i)) {
        lines[i].sendToAI = 'none';
      } else if (lineText.match(/#ai-summary\b/i) || lineText.match(/#aisummary\b/i)) {
        lines[i].sendToAI = 'summary';
      } else if (lineText.match(/#ai-title\b/i) || lineText.match(/#aititle\b/i)) {
        lines[i].sendToAI = 'title';
      }
    }
  }

  recomputeVisibleLines();
  return lines;
}

// Check if a line should be hidden (now just reflects the computed hidden flag)
export function isLineHidden(lineIdx) {
  if (!lines || lineIdx < 0 || lineIdx >= lines.length) return false;
  return !!lines[lineIdx].hidden;
}

// Get all lines as text
export function getTextFromLines() {
  return lines.map(l => l.text).join('\n');
}

// Update lines from text
export function updateLinesFromText(text) {
  const oldOpenStates = {};
  
  // Preserve open state for header lines based on their text content
  lines.forEach((l) => {
    if (l.level !== 0) {
      oldOpenStates[l.text] = l.open;
    }
  });
  
  parseText(text);
  
  lines.forEach(l => {
    if (l.level !== 0 && oldOpenStates[l.text] !== undefined) {
      l.open = oldOpenStates[l.text];
    }
  });

  recomputeVisibleLines();
  return lines;
}

// History functions
export function saveChanges(changesArray) {
  if (!historyEnabled || !changesArray || changesArray.length === 0) return;
  
  if (historyIndex < changeHistory.length - 1) {
    changeHistory = changeHistory.slice(0, historyIndex + 1);
  }
  
  changeHistory.push({
    changes: changesArray,
    timestamp: Date.now()
  });
  historyIndex++;
  
  if (changeHistory.length > MAX_HISTORY) {
    changeHistory.shift();
    historyIndex--;
  }
}

export function undo() {
  if (historyIndex < 0) return false;
  
  const logItem = changeHistory[historyIndex];
  historyEnabled = false;
  
  for (let i = logItem.changes.length - 1; i >= 0; i--) {
    const change = logItem.changes[i];
    
    if (change.previous !== '' && change.current === '') {
      lines.splice(change.lineNumber, 0, { 
        text: change.previous, 
        open: true, 
        level: 0, 
        startIdx: -1, 
        endIdx: -1, 
        id: generateLineId(),
        hidden: false
      });
    } else if (change.previous === '' && change.current !== '') {
      if (lines[change.lineNumber]) {
        lines.splice(change.lineNumber, 1);
      }
    } else {
      if (lines[change.lineNumber]) {
        lines[change.lineNumber].text = change.previous;
      }
    }
  }
  
  historyEnabled = true;
  historyIndex--;
  return true;
}

export function redo() {
  if (historyIndex >= changeHistory.length - 1) return false;
  
  historyIndex++;
  const logItem = changeHistory[historyIndex];
  historyEnabled = false;
  
  for (let i = 0; i < logItem.changes.length; i++) {
    const change = logItem.changes[i];
    
    if (change.previous === '' && change.current !== '') {
      lines.splice(change.lineNumber, 0, { 
        text: change.current, 
        open: true, 
        level: 0, 
        startIdx: -1, 
        endIdx: -1, 
        id: generateLineId(),
        hidden: false
      });
    } else if (change.previous !== '' && change.current === '') {
      if (lines[change.lineNumber]) {
        lines.splice(change.lineNumber, 1);
      }
    } else {
      if (lines[change.lineNumber]) {
        lines[change.lineNumber].text = change.current;
      }
    }
  }
  
  historyEnabled = true;
  return true;
}

export function clearHistory() {
  changeHistory = [];
  historyIndex = -1;
}

export function getLines() {
  return lines;
}

export function setLines(newLines) {
  lines = newLines;
  recomputeVisibleLines();
}

// === Localized line edit helpers ===

// Update the text of a single line without changing structure
export function updateLineText(idx, newText) {
  if (!lines || idx < 0 || idx >= lines.length) return;
  lines[idx].text = newText;
}

// Split a line at the given offset, inserting a new line below.
// Behaviour matches the existing EditorLine Enter handler, including a full
// rebuild of the model from current text.
export function splitLine(idx, offset) {
  if (!lines || idx < 0 || idx >= lines.length) return;

  const currentText = lines[idx].text || '';
  const safeOffset = Math.max(0, Math.min(offset, currentText.length));
  const beforeCursor = currentText.substring(0, safeOffset);
  const afterCursor = currentText.substring(safeOffset);

  lines[idx].text = beforeCursor;

  lines.splice(idx + 1, 0, {
    text: afterCursor,
    open: true,
    level: 0,
    startIdx: -1,
    endIdx: -1,
    sendToAI: 'all',
    id: generateLineId(),
    hidden: false,
  });

  const text = getTextFromLines();
  updateLinesFromText(text);
}

// === Localized header helpers (Step 4) ===

function applyHeaderMetadataFromText(line) {
  const text = (line.text || '').trim();

  // Reset to defaults first (open state is kept separate from tags)
  line.sendToAI = 'all';

  // AI sharing tags
  if (text.match(/#ai-hide\b/i) || text.match(/#aihide\b/i)) {
    line.sendToAI = 'none';
  } else if (text.match(/#ai-summary\b/i) || text.match(/#aisummary\b/i)) {
    line.sendToAI = 'summary';
  } else if (text.match(/#ai-title\b/i) || text.match(/#aititle\b/i)) {
    line.sendToAI = 'title';
  }
}

function computeHeaderRangeForward(idx, level) {
  if (!lines || idx < 0 || idx >= lines.length) return { startIdx: idx, endIdx: lines.length - 1 };

  let end = lines.length - 1;

  for (let i = idx + 1; i < lines.length; i++) {
    const t = (lines[i].text || '').trim();

    if (t.match(/^#chapterend$/i) && level === 1) {
      end = i;
      break;
    }
    if (t.match(/^#sectionend$/i) && level === 2) {
      end = i;
      break;
    }

    const isHeader = t.match(/^#chapter(?:\s|$)/i) || t.match(/^#section(?:\s|$)/i);
    if (isHeader) {
      const nextLevel = t.match(/^#chapter(?:\s|$)/i) ? 1 : 2;
      if (nextLevel >= level) {
        end = i - 1;
        break;
      }
    }
  }

  if (end < idx) end = idx;
  return { startIdx: idx, endIdx: end };
}

export function addChapterAt(idx) {
  if (!lines || idx < 0 || idx >= lines.length) return;
  const line = lines[idx];
  line.level = 1;
  applyHeaderMetadataFromText(line);
  recomputeVisibleLines();
}

export function addSectionAt(idx) {
  console.log("addSectionAt idx:", idx)
  if (!lines || idx < 0 || idx >= lines.length) return;
  const line = lines[idx];
  line.level = 2;
  applyHeaderMetadataFromText(line);
  recomputeVisibleLines();
}

export function removeChapterAt(idx) {
  if (!lines || idx < 0 || idx >= lines.length) return;
  const line = lines[idx];
  line.level = 0;
  line.sendToAI = 'all';
  line.open = true;

  recomputeVisibleLines();
}

export function removeSectionAt(idx) {
  if (!lines || idx < 0 || idx >= lines.length) return;
  const line = lines[idx];
  line.level = 0;
  line.sendToAI = 'all';
  line.open = true;

  recomputeVisibleLines();
}

// Merge line at idx into the previous line.
// Behaviour matches the existing EditorLine Backspace-at-start handler,
// including a full rebuild of the model from current text.
export function mergeLine(idx) {
  if (!lines || idx <= 0 || idx >= lines.length) return;

  const currentText = lines[idx].text || '';
  const prevText = lines[idx - 1].text || '';
  const mergedText = prevText + currentText;

  lines[idx - 1].text = mergedText;
  lines.splice(idx, 1);

  const text = getTextFromLines();
  updateLinesFromText(text);
}

// Recompute and cache visible lines based on current lines and fold state
export function recomputeVisibleLines() {
  if (!lines) {
    visibleLines = [];
    return visibleLines;
  }

  const result = [];
  // Stack of active headers, each entry: { level, open, hidesDescendants }
  const headerStack = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const level = l.level || 0;
    let hidden = false;
    let displayDepth = 0;

    if (level === 1 || level === 2) {
      // Header line: update stack for this level
      while (headerStack.length && headerStack[headerStack.length - 1].level >= level) {
        headerStack.pop();
      }

      const parent = headerStack[headerStack.length - 1] || null;
      const parentHides = parent ? parent.hidesDescendants : false;
      hidden = !!parentHides;

      const thisOpen = l.open !== false;
      const hidesDescendants = parentHides || !thisOpen;
      headerStack.push({ level, open: thisOpen, hidesDescendants });

      // Chapters at depth 0, sections at depth 1
      displayDepth = level === 1 ? 0 : 1;
    } else {
      // Non-header line: visibility depends on top of stack
      const parent = headerStack[headerStack.length - 1] || null;
      const parentHides = parent ? parent.hidesDescendants : false;
      hidden = !!parentHides;
      if (parent) {
        // Lines under a chapter => depth 1, under a section => depth 2
        displayDepth = parent.level === 1 ? 1 : 2;
      } else {
        displayDepth = 0;
      }
    }

    l.hidden = hidden;
    if (hidden) continue;

    result.push({ line: l, index: i, displayDepth });
  }

  visibleLines = result;
  return visibleLines;
}

// Get cached visible lines (recompute if cache is empty and lines exist)
export function getVisibleLinesCached() {
  if ((!visibleLines || visibleLines.length === 0) && lines && lines.length > 0) {
    return recomputeVisibleLines();
  }
  return visibleLines || [];
}

export function openLine(idx){
  console.log("opening line ", idx, lines[idx]);
  if (!lines || idx < 0 || idx >= lines.length) return;
  const line = lines[idx];
  console.log("setting open ", idx, line);
  line.open = true;
  recomputeVisibleLines();
}

export function closeLine(idx){
  if (!lines || idx < 0 || idx >= lines.length) return;
  const line = lines[idx];
  line.open = false;
  recomputeVisibleLines();
}