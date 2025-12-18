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
