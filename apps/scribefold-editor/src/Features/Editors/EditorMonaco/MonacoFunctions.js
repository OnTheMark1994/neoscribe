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

function createLineId(){
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

export function createLinesArrayFromMonaco(monacoEditorRef){
  // This function reads the editor text and decorations and produces:
  // 1) `linesArray` = [{ lineNumber, content, lineId }]
  // 2) `missingIdLineNumbers` = [<lineNumber>, ...] (1-based, Monaco line numbers)
  //
  // We intentionally do NOT mutate Monaco here. That is handled by `assertLineIdsIntoMonaco`.

  const editor = monacoEditorRef?.current
  if(!editor){
    return { linesArray: [], missingIdLineNumbers: [] }
  }

  const model = editor.getModel?.()
  if(!model){
    return { linesArray: [], missingIdLineNumbers: [] }
  }

  const lineCount = model.getLineCount()
  const linesArray = []
  const missingIdLineNumbers = []

  for(let lineNumber = 1; lineNumber <= lineCount; lineNumber++){
    // Read the user-visible content of this line.
    const content = model.getLineContent(lineNumber)

    // Read decorations that intersect this line.
    // We use this as our "metadata store" for ids.
    const lineDecorations = model.getLineDecorations(lineNumber)

    // Pull existing id from decorations if present.
    let lineId = getLineIdFromDecorations(lineDecorations)

    // If missing, we still generate an id for the returned array, and record this
    // line number for later decoration insertion.
    if(!lineId){
      lineId = createLineId()
      missingIdLineNumbers.push(lineNumber)
    }

    linesArray.push({
      lineNumber,
      content,
      lineId,
    })
  }

  return { linesArray, missingIdLineNumbers }
}

export function assertLineIdsIntoMonaco(monacoEditorRef, linesArray, missingIdLineNumbers){
  // This function mutates Monaco by inserting missing line-id decorations.
  // It is O(k) where k is the count of missing ids (<= total line count).
  //
  // We do a single `deltaDecorations` call for performance.

  const editor = monacoEditorRef?.current
  if(!editor) return

  const model = editor.getModel?.()
  if(!model) return

  if(!Array.isArray(linesArray) || linesArray.length === 0) return
  if(!Array.isArray(missingIdLineNumbers) || missingIdLineNumbers.length === 0) return

  const newDecorations = []

  for(const lineNumber of missingIdLineNumbers){
    // Find the corresponding line object.
    // This is O(1) if `linesArray` is in 1:1 order with Monaco lines (it is).
    const lineObj = linesArray[lineNumber - 1]
    if(!lineObj) continue

    // Monaco accepts a plain IRange object here, we don't need `monaco.Range`.
    // We anchor the decoration at column 1 so it stays attached to the line.
    newDecorations.push({
      range: {
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: 1,
      },
      options: {
        // We store the id in `description` because it's a Monaco-supported field
        // and survives subsequent reads of decorations.
        //
        // Prefix is used so we can easily identify our decorations.
        description: `sf_lineId:${lineObj.lineId}`,

        // A no-op class name (can be styled later if needed).
        // Having a real Monaco option here also helps ensure this decoration
        // isn't treated as an empty/no-op decoration.
        className: 'sfLineIdDecoration',
      },
    })
  }

  if(newDecorations.length === 0) return

  // We pass an empty array for old decorations because we are only adding.
  // (We are not yet tracking decoration ids for updates/removals.)
  editor.deltaDecorations([], newDecorations)
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
