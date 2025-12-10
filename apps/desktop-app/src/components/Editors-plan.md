# Editors Component Architecture Plan

## Problem
Editor.js = 930 lines, 3 completely different editors mixed together. Need separation.

## Solution
4 files: Editors.js (router) + ArrayEditor.js + MonacoEditor.js + TextareaEditor.js

---

## Editors.js
Router component that displays the correct editor based on Redux viewMode state.

### State
NONE - Pure presentation, reads from Redux only.

### Functions
NONE - Just conditional rendering.

### Renders
- `<ArrayEditor />` if viewMode === 'array'
- `<MonacoEditor />` if viewMode === 'monaco'
- `<TextareaEditor />` if viewMode === 'textarea'
- `<FindBar />` if isFindVisible && viewMode !== 'monaco'

---

## ArrayEditor.js
Manages fold-based editor with editorEngine lines array. Handles chapters/sections, folding, AI features.

### State

**renderTrigger** (number)
Increments to force re-render after editorEngine lines mutate.
Local because it's a React-specific rendering trigger, not business data.

**isArrayView** (boolean)
Legacy debug toggle. Can be removed if not used.

### Refs

**editorRef**
Points to FoldEditorView container DOM.
Used by FindBar for search/highlight operations.

### Functions

**toggleFold(idx)**
Toggle fold state of a single chapter/section at index.
Called internally from FoldEditorView when user clicks fold icon.
In this component because folding only exists in array view.

**foldAll()**
Fold all chapters/sections using editorEngine.
Called externally when Redux foldAllTrigger increments (from WebMenuBar).
In this component because it's array-specific folding logic.

**unfoldAll()**
Unfold all chapters/sections using editorEngine.
Called externally when Redux unfoldAllTrigger increments (from WebMenuBar).
In this component because it's array-specific folding logic.

**handleLineEdit(idx, newText)**
Update line text in editorEngine at index.
Called internally from FoldEditorView when user edits a line.
In this component because it mutates editorEngine lines array.

**handleEnterKey(idx, element)**
Split line at cursor position, create new line.
Called internally from FoldEditorView on Enter key.
In this component because it manipulates lines array structure.

**handleBackspaceAtStart(idx, element)**
Merge current line with previous line.
Called internally from FoldEditorView on Backspace at line start.
In this component because it manipulates lines array structure.

**isLineHidden(lineIdx)**
Check if line is hidden by parent fold.
Called internally by getVisibleLines() for rendering.
In this component because it uses array-specific fold state.

**getVisibleLines()**
Filter lines array to only visible lines (not folded).
Called internally to pass to FoldEditorView for rendering.
In this component because it reads array-specific fold state.

**renderEditor()**
Increment renderTrigger to force React re-render.
Called internally after any editorEngine lines mutation.
In this component because it's tied to local renderTrigger state.

**showAIContextMenu(x, y, lineIdx)**
Show Electron native context menu with AI options.
Called internally from FoldEditorView on right-click.
TODO: Move to WebMenuBar when migrating to unified menu.

**applyAIModeToLine(lines, idx, mode)**
Add AI tags (#ai-title, #ai-summary, etc) to line text.
Called internally by AI menu handlers.
In this component because AI features only apply to array view.

**applyAIModeToSections(lines, rootIdx, mode)**
Apply AI mode to all sections in a chapter.
Called internally by AI menu handlers.
In this component because chapter/section concept only exists in array view.

**cleanAITags(text)**
Remove all AI tags from text string.
Called internally by AI functions to reset tags.
In this component because it's AI-specific utility.

**ensureChapterSummarySection(chapterIdx)**
Create #summary section in chapter if missing.
Called internally by AI menu handlers.
In this component because it's array-specific AI feature.

**extractContent()**
Get full text from editorEngine using getTextFromLines().
Called externally by WebMenuBar when saving file.
In this component because it knows how to read editorEngine format.

---

## MonacoEditor.js
Thin wrapper around Monaco code editor. Handles Monaco-specific operations using Monaco API.

### State

**content** (string)
Current editor content for Monaco controlled input.
Local for fast typing performance. Syncs to Redux on save, not on every keystroke.

### Refs

**monacoRef**
Reference to Monaco editor instance.
Needed for synchronous API calls like getValue(), getAction(), etc.

### Functions

**handleContentChange(newContent)**
DO NOT UPDATE ANYTHING ON CHANGE. Do not update state on change. 
do not set value or call onChange. USE devaultValue={initial value} only 
Called internally from MonacoEditorView onChange callback.
In this component because it manages Monaco-specific content state.

**foldAll()**
Call Monaco's built-in 'editor.foldAll' action.
Called externally when Redux foldAllTrigger increments (from WebMenuBar).
In this component because it uses Monaco-specific API.

**unfoldAll()**
Call Monaco's built-in 'editor.unfoldAll' action.
Called externally when Redux unfoldAllTrigger increments (from WebMenuBar).
In this component because it uses Monaco-specific API.

**extractContent()**
Get current content from monacoRef.current.getValue().
Called externally by WebMenuBar when saving file.
In this component because it knows how to read from Monaco instance.

---

## TextareaEditor.js
Simple plain text editor using native textarea. Minimal features, maximum simplicity.

### State

**content** (string)
Current textarea content for controlled input.
Local for fast typing performance. Syncs to Redux on save.

### Refs

**textareaRef**
Reference to textarea DOM element.
Needed for synchronous getValue() on save operations.

### Functions

**handleContentChange(newContent)**
Update local content state and mark file as modified.
Called internally from TextareaEditorView onChange callback.
In this component because it manages textarea-specific content state.

**extractContent()**
Get current content from textareaRef.current.value.
Called externally by WebMenuBar when saving file.
In this component because it knows how to read from textarea DOM.

---

## User Flows

### Flow 1: File Open
1. User clicks File > Open in WebMenuBar
2. WebMenuBar calls electronAPI.openFile()
3. WebMenuBar dispatches setContent(fileContent) to Redux
4. WebMenuBar dispatches setCurrentFilePath(path) to Redux
5. Active editor (Array/Monaco/Textarea) has useEffect watching Redux content
6. Editor syncs Redux content to local state or editorEngine
7. Editor renders new content

### Flow 2: View Mode Change
1. User clicks View > Switch to Monaco in WebMenuBar
2. WebMenuBar dispatches setViewMode('monaco') to Redux
3. Editors.js has useSelector(selectViewMode)
4. Editors.js re-renders, unmounts old editor, mounts MonacoEditor
5. MonacoEditor useEffect reads Redux content
6. MonacoEditor initializes with content and renders

### Flow 3: User Typing (Monaco)
1. User types in Monaco editor
2. Monaco fires onChange event
3. MonacoEditor.handleContentChange(newContent) called
4. Local content state updates: setContent(newContent)
5. Dispatches setIsModified(true) to Redux
6. StatusBar shows "Modified" indicator

### Flow 4: User Typing (Array)
1. User edits a line in FoldEditorView
2. FoldEditorView calls ArrayEditor.handleLineEdit(idx, newText)
3. handleLineEdit mutates editorEngine lines[idx].text
4. handleLineEdit calls renderEditor() to increment renderTrigger
5. renderTrigger change causes re-render
6. Dispatches setIsModified(true) to Redux

### Flow 5: Save File
1. User clicks File > Save in WebMenuBar
2. WebMenuBar reads Redux viewMode
3. WebMenuBar gets content based on viewMode:
   - If 'array': calls editorEngine.getTextFromLines()
   - If 'monaco': calls monacoRef.current?.getValue()
   - If 'textarea': calls textareaRef.current?.value
4. WebMenuBar calls electronAPI.saveFile(path, content)
5. WebMenuBar dispatches setIsModified(false) to Redux
6. WebMenuBar dispatches showStatus('File saved')

### Flow 6: Fold All (Array View)
1. User clicks View > Fold All in WebMenuBar
2. WebMenuBar dispatches incrementFoldAllTrigger() to Redux
3. ArrayEditor has useEffect watching foldAllTrigger
4. ArrayEditor.foldAll() called
5. foldAll() mutates editorEngine to set all open=false
6. foldAll() calls renderEditor() to trigger re-render
7. Dispatches setIsModified(true) to Redux

### Flow 7: Fold All (Monaco View)
1. User clicks View > Fold All in WebMenuBar
2. WebMenuBar dispatches incrementFoldAllTrigger() to Redux
3. MonacoEditor has useEffect watching foldAllTrigger
4. MonacoEditor.foldAll() called
5. foldAll() calls monacoRef.current.getAction('editor.foldAll').run()
6. Monaco handles folding with built-in API
7. No Redux dispatch needed (Monaco tracks its own fold state)

### Flow 8: Find (Ctrl+F in Array/Textarea)
1. User presses Ctrl+F
2. Editors.js keyboard handler dispatches setIsFindVisible(true)
3. Editors.js renders FindBar (only if viewMode !== 'monaco')
4. FindBar searches using editorRef or textareaRef
5. FindBar highlights matches and navigates

### Flow 9: Find (Ctrl+F in Monaco)
1. User presses Ctrl+F
2. Editors.js keyboard handler detects viewMode === 'monaco'
3. Calls monacoRef.current.getAction('actions.find').run()
4. Monaco shows its built-in find UI
5. FindBar component NOT shown

---

## How WebMenuBar Gets Content

WebMenuBar needs to extract content from the active editor for save operations. Options:

**Option 1: Direct ref access (current approach)**
```javascript
// WebMenuBar reads refs based on viewMode
if (viewMode === 'array') content = editorEngine.getTextFromLines();
if (viewMode === 'monaco') content = monacoRef.current?.getValue();
if (viewMode === 'textarea') content = textareaRef.current?.value;
```
Problem: WebMenuBar needs refs to all editors (tight coupling).

**Option 2: Expose extractContent() method via ref**
```javascript
// Each editor exposes extractContent via useImperativeHandle
const arrayEditorRef = useRef();
const monacoEditorRef = useRef();
const textareaEditorRef = useRef();

// WebMenuBar calls
const content = currentEditorRef.current.extractContent();
```
Problem: Still needs refs, need to know which editor is active.

**Option 3: Store content in Redux on every change**
```javascript
// Each editor dispatches setContent(newContent) on change
// WebMenuBar reads from Redux
const content = useSelector(selectContent);
```
Problem: Performance hit, Redux updates on every keystroke.

**Option 4: Store content in Redux on blur/debounce**
```javascript
// Each editor dispatches setContent on blur or debounced
// WebMenuBar reads from Redux
```
Winner: Good balance of performance and decoupling.

**Recommendation**: Use Option 4. Each editor syncs to Redux on blur or 1-second debounce.

---

## Migration Plan

### Phase 1: Create Files (No Breaking Changes)
1. Create `src/components/Editors/Editors.js` (router)
2. Create `src/components/ArrayEditor/ArrayEditor.js` (extract from Editor.js)
3. Create `src/components/MonacoEditor/MonacoEditor.js` (extract from Editor.js)
4. Create `src/components/TextareaEditor/TextareaEditor.js` (extract from Editor.js)
5. Keep old `Editor.js` untouched during development

### Phase 2: Wire Up
1. Update `App.js` to use `<Editors />` instead of `<Editor />`
2. Test each view renders
3. Test file open/save
4. Test find operations
5. Test fold operations
6. Test view switching

### Phase 3: Cleanup
1. Delete old `Editor.js`
2. Update all imports
3. Remove EditorContext if not needed
4. Remove unused functions

---

## Open Questions

1. **How should WebMenuBar get content for save?**
   - Recommendation: Each editor syncs to Redux on blur/debounce

2. **Keep EditorContext or remove?**
   - Recommendation: Remove, use Redux directly

3. **Keep isArrayView debug toggle?**
   - Recommendation: Remove if not actively used

4. **Move AI context menu to WebMenuBar?**
   - Recommendation: Yes, when migrating to unified menu

---

## Files to Create

```
src/components/Editors/
  Editors.js              (new router)
  Editors.css             (minimal styles)

src/components/ArrayEditor/
  ArrayEditor.js          (extracted from Editor.js)
  ArrayEditor.css         (array-specific styles)
  
src/components/MonacoEditor/
  MonacoEditor.js         (extracted from Editor.js)
  MonacoEditorView.js     (move from current location)
  
src/components/TextareaEditor/
  TextareaEditor.js       (extracted from Editor.js)
  TextareaEditorView.js   (move from current location)
```
