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

  const stack = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].text.trim();
    let level = 0, isHeader = false;

    if (line.match(/^#chapter(?:\s|$)/i)) { 
      level = 1; 
      isHeader = true;
    } else if (line.match(/^#section(?:\s|$)/i)) { 
      level = 2; 
      isHeader = true;
    }

    lines[i].level = level;
    
    if (isHeader) {
      // Determine AI sharing mode from tags on the header line
      if (line.match(/#ai-hide\b/i) || line.match(/#aihide\b/i)) {
        lines[i].sendToAI = 'none';
      } else if (line.match(/#ai-summary\b/i) || line.match(/#aisummary\b/i)) {
        lines[i].sendToAI = 'summary';
      } else if (line.match(/#ai-title\b/i) || line.match(/#aititle\b/i)) {
        lines[i].sendToAI = 'title';
      }
      
      if (line.match(/#folded\b/i)) {
        lines[i].open = false;
      }
    }

    if (isHeader) {
      while (stack.length && stack[stack.length - 1].level >= level) {
        const prev = stack.pop();
        lines[prev.idx].endIdx = Math.max(prev.idx, i - 1);
      }
      lines[i].startIdx = i;
      stack.push({ idx: i, level });
    } else if (line.match(/^#chapterend$/i)) {
      while (stack.length) {
        const prev = stack.pop();
        if (lines[prev.idx].level === 1) {
          lines[prev.idx].endIdx = i;
          break;
        }
      }
    } else if (line.match(/^#sectionend$/i)) {
      while (stack.length) {
        const prev = stack.pop();
        if (lines[prev.idx].level === 2) {
          lines[prev.idx].endIdx = i;
          break;
        }
      }
    }
  }
  
  while (stack.length) {
    const prev = stack.pop();
    lines[prev.idx].endIdx = lines.length - 1;
  }

  recomputeVisibleLines();
  return lines;
}

// Check if a line should be hidden
export function isLineHidden(lineIdx) {
  for (let j = lineIdx - 1; j >= 0; j--) {
    const p = lines[j];
    if (p.startIdx !== -1 && p.endIdx >= lineIdx && !p.open) {
      return true;
    }
  }
  return false;
}

// Get all lines as text
export function getTextFromLines() {
  return lines.map(l => l.text).join('\n');
}

// Update lines from text
export function updateLinesFromText(text) {
  const oldOpenStates = {};
  
  lines.forEach((l, i) => {
    if (l.startIdx !== -1) {
      oldOpenStates[l.text] = l.open;
    }
  });
  
  parseText(text);
  
  lines.forEach(l => {
    if (l.startIdx !== -1 && oldOpenStates[l.text] !== undefined) {
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

  // Reset to defaults first
  line.sendToAI = 'all';
  line.open = true;

  // AI sharing tags
  if (text.match(/#ai-hide\b/i) || text.match(/#aihide\b/i)) {
    line.sendToAI = 'none';
  } else if (text.match(/#ai-summary\b/i) || text.match(/#aisummary\b/i)) {
    line.sendToAI = 'summary';
  } else if (text.match(/#ai-title\b/i) || text.match(/#aititle\b/i)) {
    line.sendToAI = 'title';
  }

  // Folded state tag
  if (text.match(/#folded\b/i)) {
    line.open = false;
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
  const range = computeHeaderRangeForward(idx, 1);
  line.startIdx = range.startIdx;
  line.endIdx = range.endIdx;
  recomputeVisibleLines();
}

export function addSectionAt(idx) {
  console.log("addSectionAt idx:", idx)
  if (!lines || idx < 0 || idx >= lines.length) return;
  const line = lines[idx];
  line.level = 2;
  applyHeaderMetadataFromText(line);
  const range = computeHeaderRangeForward(idx, 2);
  line.startIdx = range.startIdx;
  line.endIdx = range.endIdx;
  recomputeVisibleLines();
}

export function removeChapterAt(idx) {
  if (!lines || idx < 0 || idx >= lines.length) return;
  const line = lines[idx];
  line.level = 0;
  line.startIdx = -1;
  line.endIdx = -1;
  line.sendToAI = 'all';
  line.open = true;
  recomputeVisibleLines();
}

export function removeSectionAt(idx) {
  if (!lines || idx < 0 || idx >= lines.length) return;
  const line = lines[idx];
  line.level = 0;
  line.startIdx = -1;
  line.endIdx = -1;
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
  let currentDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    const derivedHidden = isLineHidden(i);
    l.hidden = !!derivedHidden;
    if (derivedHidden) continue;

    let displayDepth = currentDepth;

    if (l.startIdx !== -1 && l.endIdx !== -1) {
      if (l.level === 1) {
        displayDepth = 0;
        currentDepth = 1;
      } else if (l.level === 2) {
        displayDepth = 1;
        currentDepth = 2;
      }
    }

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
