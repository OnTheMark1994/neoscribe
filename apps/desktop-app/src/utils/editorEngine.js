// Foldable Text Editor Engine
// State: lines array where each entry is {text, open, level, startIdx, endIdx, id, sendToAI}

let lines = [];

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
    id: generateLineId()
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
        id: generateLineId() 
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
        id: generateLineId() 
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
}
