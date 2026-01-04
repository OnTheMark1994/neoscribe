/*

  MonacoFunctions

  This file contains helper functions that operate on Monaco editor instances.

  We keep these helpers separate so:
    - The AI Chat "Send" button can call into shared editor utilities
    - EditorMonaco can stay focused on mounting/configuring Monaco
    - We avoid duplicating Monaco logic later when other features need it

  NOTE:
    These helpers expect a `monacoEditorRef` created via React `useRef(null)`
    where `monacoEditorRef.current` is assigned to the Monaco editor instance
    in EditorMonaco's `onMount` callback.

*/

export function assertLineIds(editorRef){
  
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

export function getEditorContentWithMetadata(editorRef) {
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

export function logMonacoEditorLines(monacoEditorRef) {
  // This log is intentionally very explicit so debugging ref wiring is easy.
  console.log('[MonacoFunctions] logMonacoEditorLines called', {
    hasRef: Boolean(monacoEditorRef),
    hasCurrent: Boolean(monacoEditorRef?.current),
    currentType: typeof monacoEditorRef?.current,
  })

  // If the ref wasn't passed in or Monaco hasn't mounted yet, we can't read lines.
  if (!monacoEditorRef?.current) {
    console.log('[MonacoFunctions] Monaco editor not ready (monacoEditorRef.current is missing)')
    return
  }

  const editor = monacoEditorRef.current

  // Monaco stores the text buffer in a model.
  const model = editor.getModel?.()
  if (!model) {
    console.log('[MonacoFunctions] Monaco model not available yet')
    return
  }

  const lineCount = model.getLineCount()
  console.log('[MonacoFunctions] Monaco model lineCount:', lineCount)

  const lines = []

  // Monaco line numbers are 1-based.
  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const content = model.getLineContent(lineNumber)

    lines.push({
      lineNumber,
      content,
    })
  }

  console.log('[MonacoFunctions] Monaco lines:', lines)
}

export function createLineId(){
  // Prefer stable UUIDs when available (browser + modern runtimes).
  if(typeof crypto !== 'undefined' && crypto?.randomUUID){
    return crypto.randomUUID()
  }

  // Fallback:
  // This is still fine for session-only ids.
  return `line_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function getLineIdFromDecorations(lineDecorations){
  // Monaco returns an array of decoration objects (or null).
  //
  // IMPORTANT:
  // We store our id in `options.description` because it is a Monaco-supported
  // field that persists. Custom fields like `options.__lineId` are not reliably
  // retained by Monaco when later reading decorations.
  if(!Array.isArray(lineDecorations)) return null

  for(const decoration of lineDecorations){
    const description = decoration?.options?.description
    if(typeof description !== 'string') continue

    // We keep a prefix so we can safely coexist with other decorations.
    if(description.startsWith('sf_lineId:')){
      return description.slice('sf_lineId:'.length)
    }
  }

  return null
}

export function getLineMetadataFromDecorations(lineDecorations) {
  if (!Array.isArray(lineDecorations)) return null;
  
  for (const decoration of lineDecorations) {
    const description = decoration?.options?.description;
    if (typeof description !== 'string') continue;
    
    if (description.startsWith('sf_meta:')) {
      try {
        return JSON.parse(description.slice('sf_meta:'.length));
      } catch (e) {
        console.error('Failed to parse line metadata:', e);
        return null;
      }
    }
  }
  return null;
}

export function createLineMetadataDecoration(lineNumber, metadata) {
  return {
    range: {
      startLineNumber: lineNumber,
      startColumn: 1,
      endLineNumber: lineNumber,
      endColumn: 1
    },
    options: {
      description: `sf_meta:${JSON.stringify(metadata)}`,
      className: 'sfLineMetadataDecoration'
    }
  };
}

export function createLinesArrayFromMonaco(monacoEditorRef){
  const editor = monacoEditorRef?.current;
  if(!editor) return { linesArray: [], missingIdLineNumbers: [] };

  const model = editor.getModel?.();
  if(!model) return { linesArray: [], missingIdLineNumbers: [] };

  const lineCount = model.getLineCount();
  const linesArray = [];
  const missingIdLineNumbers = [];

  for(let lineNumber = 1; lineNumber <= lineCount; lineNumber++){
    const content = model.getLineContent(lineNumber);
    const lineDecorations = model.getLineDecorations(lineNumber);
    
    // Get all metadata including aiShare
    const metadata = getLineMetadataFromDecorations(lineDecorations) || {};
    
    // If missing lineId, generate one
    if(!metadata.lineId) {
      metadata.lineId = createLineId();
      missingIdLineNumbers.push(lineNumber);
    }

    linesArray.push({
      lineNumber,
      content,
      ...metadata // Spread all metadata including aiShare
    });
  }

  return { linesArray, missingIdLineNumbers };
}

export function assertLineIdsIntoMonaco(monacoEditorRef, linesArray, missingIdLineNumbers){
  const editor = monacoEditorRef?.current;
  if(!editor) return;

  const model = editor.getModel?.();
  if(!model) return;

  if(!Array.isArray(linesArray) || linesArray.length === 0) return;
  if(!Array.isArray(missingIdLineNumbers) || missingIdLineNumbers.length === 0) return;

  const newDecorations = [];

  for(const lineNumber of missingIdLineNumbers){
    const lineObj = linesArray[lineNumber - 1];
    if(!lineObj) continue;

    // Prepare metadata object
    const metadata = {
      lineId: lineObj.lineId,
      aiShare: lineObj.aiShare
    };

    newDecorations.push(createLineMetadataDecoration(lineNumber, metadata));
  }

  if(newDecorations.length === 0) return;
  editor.deltaDecorations([], newDecorations);
}

export function getLinesArrayWithAssertedIds(monacoEditorRef){
  // This is the "one function" you call on Send.
  // It ensures ids exist in Monaco, then returns the final array.

  // 1) Build lines + compute which lines are missing ids. O(n) n =  number of lines
  const { linesArray, missingIdLineNumbers } = createLinesArrayFromMonaco(monacoEditorRef)

  // 2) Assert missing ids back into Monaco decorations. O(m) m = number of lines missing ids
  if(missingIdLineNumbers.length > 0){
    assertLineIdsIntoMonaco(monacoEditorRef, linesArray, missingIdLineNumbers)
  }

  // 3) Optional (currently skipped for performance):
  // Rebuild so the returned array is guaranteed to match what Monaco now stores.
  //
  // Why you might want this later:
  //  - "trust but verify" that the ids were truly persisted into Monaco decorations
  //  - protection against rare timing edge cases where Monaco state changes between steps
  //
  // For now we return `linesArray` from step 1 since it already contains ids for every line
  // (either read from decorations or generated for missing ones). This keeps this helper
  // to a single full scan per Send in the common case.
  //
  // return createLinesArrayFromMonaco(monacoEditorRef).linesArray
  return linesArray
}

export function setMonacoEditorContent(monacoEditorRef, content) {
  const editor = monacoEditorRef?.current;
  if (!editor || typeof editor.setValue !== 'function') return false;

  editor.__sfIsHydrating = true;
  editor.setValue(String(content ?? ''));
  editor.__sfIsHydrating = false;
  return true;
}

export function insertTextAtMonacoCursor(monacoEditorRef, text) {
  const editor = monacoEditorRef?.current;
  if (!editor || typeof editor.executeEdits !== 'function') return false;

  const model = editor.getModel?.();
  if (!model) return false;

  const selection = editor.getSelection?.();
  if (!selection) return false;

  editor.pushUndoStop?.();
  editor.executeEdits('sf_keyboard', [
    {
      range: selection,
      text: String(text ?? ''),
      forceMoveMarkers: true,
    },
  ]);
  editor.pushUndoStop?.();
  editor.focus?.();
  return true;
}

export function backspaceAtMonacoCursor(monacoEditorRef) {
  const editor = monacoEditorRef?.current;
  if (!editor || typeof editor.executeEdits !== 'function') return false;

  const model = editor.getModel?.();
  if (!model) return false;

  const selection = editor.getSelection?.();
  if (!selection) return false;

  // If there is a selection, delete it.
  if (typeof selection.isEmpty === 'function' ? !selection.isEmpty() : !(selection.startLineNumber === selection.endLineNumber && selection.startColumn === selection.endColumn)) {
    editor.pushUndoStop?.();
    editor.executeEdits('sf_keyboard', [{ range: selection, text: '', forceMoveMarkers: true }]);
    editor.pushUndoStop?.();
    editor.focus?.();
    return true;
  }

  const pos = editor.getPosition?.();
  if (!pos) return false;

  // At very start of document: nothing to delete.
  if (pos.lineNumber === 1 && pos.column === 1) return true;

  let range;

  if (pos.column > 1) {
    range = {
      startLineNumber: pos.lineNumber,
      startColumn: pos.column - 1,
      endLineNumber: pos.lineNumber,
      endColumn: pos.column,
    };
  } else {
    // Column 1: delete the newline by merging with previous line.
    const prevLine = pos.lineNumber - 1;
    const prevLen = model.getLineLength(prevLine);
    range = {
      startLineNumber: prevLine,
      startColumn: prevLen + 1,
      endLineNumber: pos.lineNumber,
      endColumn: 1,
    };
  }

  editor.pushUndoStop?.();
  editor.executeEdits('sf_keyboard', [{ range, text: '', forceMoveMarkers: true }]);
  editor.pushUndoStop?.();
  editor.focus?.();
  return true;
}

export function handleMiniKeyboardMonacoKeyPress(monacoEditorRef, key) {
  const k = String(key ?? '');
  if (!k) return false;

  if (k === 'Backspace') return backspaceAtMonacoCursor(monacoEditorRef);
  if (k === 'Enter') return insertTextAtMonacoCursor(monacoEditorRef, '\n');
  return insertTextAtMonacoCursor(monacoEditorRef, k);
}

export function getAIVisibleLinesWithAssertedIds(monacoEditorRef) {
  const editor = monacoEditorRef?.current;
  if (!editor) return [];
  
  const model = editor.getModel?.();
  if (!model) return [];
  
  const linesContent = model.getLinesContent();
  const result = [];
  const newDecorations = [];

  let chapterHidden = false;
  let sectionHidden = false;

  // Cycle through all lines
  linesContent.forEach((content, i) => {
    const lineDecorations = model.getLineDecorations(i + 1);
    let metadata = getLineMetadataFromDecorations(lineDecorations) || {};
    
    const trimmed = content.trim();
    const isChapter = trimmed === '#chapter' || trimmed.startsWith('#chapter ');
    const isSection = trimmed === '#section' || trimmed.startsWith('#section ');

    // Update visibility state
    if (isChapter) {
      chapterHidden = metadata.aiShare === 'hide';
      sectionHidden = false;
    } else if (isSection) {
      sectionHidden = chapterHidden || metadata.aiShare === 'hide';
    }

    // Assert line ID
    if (!metadata.lineId) {
      metadata = { ...metadata, lineId: createLineId() };
      newDecorations.push(createLineMetadataDecoration(i + 1, metadata));
    }

    // Add to result if visible
    if (!chapterHidden && !sectionHidden) {
      result.push({
        content,
        lineId: metadata.lineId
      });
    }
  });

  // Apply decorations
  if (newDecorations.length > 0) {
    editor.deltaDecorations([], newDecorations);
  }

  return result;
}

// Helper for updateDecorations (used in monaco onMount updateDecorations function)
export const getSectionIcon = (isSection, isHidden, parentChapterHidden) => {
  // Chapter logic
  if (!isSection) 
    return isHidden ? 'ai-hide-icon' : 'ai-eye-icon';
  
  // Section logic
  if(isHidden)
    // when hidden it always shows hide icon
    return 'ai-hide-icon'
  // If showing
  else
    // And the parent is hidden show the icon but grey
    if(parentChapterHidden)
      return 'ai-eye-icon-grey'
    // And parent is showing (so its showing) show the ai show icon
    else
      return 'ai-eye-icon'
  

};

// Helper for updateDecorations (used in monaco onMount updateDecorations function)
export const getSectionHoverMessage = (isSection, isHidden, parentChapterHidden) => {
  if (!isSection) {
    return isHidden ? 'Hidden from AI' : 'Visible to AI';
  }
  
  if (parentChapterHidden) {
    return 'Hidden because parent chapter hidden';
  }
  
  return isHidden ? 'Hidden from AI' : 'Visible to AI';
};
