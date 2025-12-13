// Foldable Text Editor Engine
//
// Invariants:
// - After initial parse, `lines` is the single source of truth for the document.
// - We do NOT reconstruct `lines` from a joined text string during normal editing
//   operations (split, merge, header toggles). Those functions must mutate `lines`
//   directly and then call `recomputeVisibleLines()`.
// - Line `id` values are stable and only change when a line is actually inserted
//   or deleted.
// - All algorithms should do the minimum necessary work: prefer iterating only the
//   affected subrange of `lines` (O(m) where m < n) instead of scanning the entire
//   array when a local update is sufficient.
//
// State: lines array where each entry is {text, open, level, id, sendToAI, hidden}

let lines = [];
let visibleLines = [];

// Remove AI and fold tags from a raw line of text, returning the cleaned text.
// Tags are persisted only on save via getTextFromLines; in-memory line.text is kept
// free of these markers so the UI can work with clean content.
function stripAiAndFoldTags(rawText) {
  if (!rawText) return '';
  return rawText
    // AI visibility / mode tags
    .replace(/\s*#ai-hide\b/gi, '')
    .replace(/\s*#ai-summary\b/gi, '')
    .replace(/\s*#ai-title\b/gi, '')
    // Legacy variants without dash
    .replace(/\s*#aihide\b/gi, '')
    .replace(/\s*#aisummary\b/gi, '')
    .replace(/\s*#aititle\b/gi, '')
    // Fold state tag
    .replace(/\s*#folded\b/gi, '');
}

// === Tag helpers for trailing `#tags` suffix ===
// Format: "visible content #tags#ai-hide#folded" (tags must be at end of line)

export function parseTagsFromText(text) {
  const raw = text || '';
  const trimmed = raw.trimEnd();

  const match = trimmed.match(/^(.*?)(\s+#tags(#[^\s#]+)*)\s*$/i);
  if (!match) {
    return { content: raw, tags: [] };
  }

  const content = match[1] || '';
  const tagsPart = match[2] || '';
  const hashTags = tagsPart.match(/#[^\s#]+/g) || [];

  const tags = hashTags
    .map(t => t.slice(1))
    .filter(t => t.toLowerCase() !== 'tags');

  return { content, tags };
}

export function buildTextWithTags(content, tags) {
  const base = (content || '').replace(/\s+$/g, '');
  if (!tags || tags.length === 0) {
    return base;
  }

  const seen = new Set();
  const normalized = [];
  for (const t of tags) {
    if (!t) continue;
    const key = t.toLowerCase();
    if (key === 'tags') continue;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(t);
  }

  if (normalized.length === 0) {
    return base;
  }

  return `${base} #tags${normalized.map(t => `#${t}`).join('')}`;
}

export function addTagToText(text, tag) {
  const cleanTag = (tag || '').replace(/^#+/, '');
  if (!cleanTag) return text || '';

  const { content, tags } = parseTagsFromText(text);
  if (tags.map(t => t.toLowerCase()).includes(cleanTag.toLowerCase())) {
    return buildTextWithTags(content, tags);
  }

  return buildTextWithTags(content, [...tags, cleanTag]);
}

export function removeTagFromText(text, tag) {
  const cleanTag = (tag || '').replace(/^#+/, '');
  if (!cleanTag) return text || '';

  const { content, tags } = parseTagsFromText(text);
  const filtered = tags.filter(t => t.toLowerCase() !== cleanTag.toLowerCase());
  return buildTextWithTags(content, filtered);
}

export function stripTagsFromTextForDisplay(text) {
  const { content } = parseTagsFromText(text);
  return content;
}

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
  const raw = (text || '').split('\n');

  lines = raw.map(t => {
    const full = t || '';
    const { content, tags } = parseTagsFromText(full);

    // Derive AI mode + fold state from tags only
    const sendToAI = getAiModeFromTagsAndText(tags, full);
    const hasFolded = tags.map(x => x.toLowerCase()).includes('folded');

    let level = 0;
    const trimmed = (content || '').trim();
    if (/^#chapter(?:\s|$)/i.test(trimmed)) level = 1;
    else if (/^#section(?:\s|$)/i.test(trimmed)) level = 2;

    return {
      text: content,        // clean text, no #tags suffix
      open: !hasFolded,     // closed if folded tag present
      level,
      sendToAI,
      id: generateLineId(),
      hidden: false,
    };
  });

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
  return lines.map(l => {
    const t = l.text || '';
    const tags = [];

    // AI sharing tags from sendToAI mode
    if (l.sendToAI === 'none') tags.push('ai-hide');
    else if (l.sendToAI === 'summary') tags.push('ai-summary');
    else if (l.sendToAI === 'title') tags.push('ai-title');

    // Fold state tag for headers: closed headers get folded
    if (l.level !== 0 && l.open === false) {
      tags.push('folded');
    }

    return buildTextWithTags(t, tags);
  }).join('\n');
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
    sendToAI: 'all',
    id: generateLineId(),
    hidden: false,
  });

  recomputeVisibleLines();
}

// === Localized header helpers (Step 4) ===

function getAiModeFromTagsAndText(tags, fullText) {
  const lowerTags = (tags || []).map(t => t.toLowerCase());

  if (lowerTags.includes('ai-hide') || lowerTags.includes('aihide')) {
    return 'none';
  }
  if (lowerTags.includes('ai-summary') || lowerTags.includes('aisummary')) {
    return 'summary';
  }
  if (lowerTags.includes('ai-title') || lowerTags.includes('aititle')) {
    return 'title';
  }

  const text = (fullText || '').trim();
  if (text.match(/#ai-hide\b/i) || text.match(/#aihide\b/i)) {
    return 'none';
  }
  if (text.match(/#ai-summary\b/i) || text.match(/#aisummary\b/i)) {
    return 'summary';
  }
  if (text.match(/#ai-title\b/i) || text.match(/#aititle\b/i)) {
    return 'title';
  }

  return 'all';
}

export function getAiModeFromText(text) {
  const { tags } = parseTagsFromText(text || '');
  return getAiModeFromTagsAndText(tags, text || '');
}

export function applyAiModeToText(text, mode) {
  const targetMode = mode || 'all';
  const { content, tags } = parseTagsFromText(text || '');
  const lower = tags.map(t => t.toLowerCase());
  const withoutAiTags = tags.filter(t => {
    const lt = t.toLowerCase();
    return lt !== 'ai-hide' && lt !== 'aihide' && lt !== 'ai-summary' && lt !== 'aisummary' && lt !== 'ai-title' && lt !== 'aititle';
  });

  if (targetMode === 'all') {
    return buildTextWithTags(content, withoutAiTags);
  }

  let aiTag = null;
  if (targetMode === 'none') aiTag = 'ai-hide';
  else if (targetMode === 'summary') aiTag = 'ai-summary';
  else if (targetMode === 'title') aiTag = 'ai-title';

  const nextTags = aiTag ? [...withoutAiTags, aiTag] : withoutAiTags;
  return buildTextWithTags(content, nextTags);
}

function applyHeaderMetadataFromText(line) {
  const raw = line.text || '';
  const { tags } = parseTagsFromText(raw);

  line.sendToAI = getAiModeFromTagsAndText(tags, raw);
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
export function mergeLine(idx) {
  if (!lines || idx <= 0 || idx >= lines.length) return;

  const currentText = lines[idx].text || '';
  const prevText = lines[idx - 1].text || '';
  const mergedText = prevText + currentText;

  lines[idx - 1].text = mergedText;
  lines.splice(idx, 1);

  recomputeVisibleLines();
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