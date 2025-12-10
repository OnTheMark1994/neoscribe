# File Operations Data Flow

## Open File Flow

**User Action**: File > Open or Ctrl+O

```
1. User triggers open
   ↓
2. Electron: dialog.showOpenDialog() returns filePath
   ↓
3. Electron: fs.readFileSync(filePath) returns content
   ↓
4. Returns to renderer: { success: true, filePath, content }
   ↓
5. Editor.handleOpen receives result
   ↓
6. Editor immediately updates filePathRef.current = result.filePath (CRITICAL: synchronous)
   ↓
7. Editor calls setContent(result.content) (local state for Monaco/textarea)
   ↓
8. Editor dispatches setCurrentFilePath(result.filePath) to Redux
   ↓
9. Editor dispatches setIsModified(false) to Redux
   ↓
10. Editor calls parseText(result.content) (updates editorEngine lines array)
   ↓
11. Editor stores localStorage.setItem('lastOpenedFile', result.filePath)
```

**Redux State Changes**:
- `editorSlice.currentFilePath`: null → "/path/to/file.txt"
- `editorSlice.isModified`: true → false

**Why this design**:
- `filePathRef.current` updated SYNCHRONOUSLY to prevent race condition on fast Ctrl+S
- Redux holds canonical file path for window title, but ref is source of truth for save operations
- localStorage enables reload-last-file on app restart

---

## Edit Content Flow

**User Action**: Type in Monaco editor

```
1. User types character
   ↓
2. Monaco fires onDidChangeModelContent
   ↓
3. MonacoEditorView calls onContentChange(null) (null = don't sync full content)
   ↓
4. Editor's handler checks if newContent !== null (skip setContent for performance)
   ↓
5. Editor dispatches setIsModified(true) to Redux
   ↓
6. Redux updates → window.isModified = true
   ↓
7. App.js useEffect sees isModified change → updates document.title to show "*"
```

**Redux State Changes**:
- `editorSlice.isModified`: false → true

**Why this design**:
- Performance: Don't sync full document content on every keystroke (O(n) operation avoided)
- Monaco editor IS the source of truth while editing
- Redux `isModified` flag triggers UI updates (window title "*")

---

## Save File Flow (Ctrl+S)

**User Action**: Ctrl+S or File > Save

```
1. User presses Ctrl+S
   ↓
2. Editor.js keydown listener (capture phase) intercepts event
   ↓
3. Calls handleSaveRef.current() (ref to always get latest function)
   ↓
4. handleSave() reads filePath from filePathRef.current (NOT Redux)
   ↓
5. handleSave() gets content based on viewMode:
   - monaco: monacoRef.current.getValue() (directly from Monaco instance)
   - textarea: textareaRef.current.value (directly from DOM)
   - array: getTextFromLines() (from editorEngine)
   ↓
6. Calls window.electronAPI.saveFile(filePath, textContent)
   ↓
7. Electron IPC handler receives { filePath, content }
   ↓
8. Electron: fs.writeFileSync(filePath, content, 'utf-8') writes to FILE SYSTEM
   ↓
9. Returns { success: true }
   ↓
10. Editor dispatches setIsModified(false) to Redux
   ↓
11. Shows status message "File saved successfully"
```

**File System Interaction**:
- `fs.writeFileSync(filePath, content, 'utf-8')` writes to disk at absolute path
- Path is absolute (e.g., `C:\Users\...\file.txt` or `/home/.../file.txt`)

**Why this design**:
- Ctrl+S uses filePathRef NOT Redux to avoid async race conditions
- Content retrieved directly from view source (Monaco/textarea/engine) for accuracy
- Electron fs.writeFileSync is synchronous = atomic write operation
- Uses capture phase for keydown to intercept before Monaco handles it

---

## Save As Flow

**User Action**: File > Save As

```
1. User triggers Save As
   ↓
2. handleSaveAs() gets content from current view
   ↓
3. Calls window.electronAPI.saveFileAs(textContent)
   ↓
4. Electron: dialog.showSaveDialog() shows dialog
   ↓
5. User selects path, Electron returns filePath
   ↓
6. Electron: fs.writeFileSync(filePath, content, 'utf-8')
   ↓
7. Returns { success: true, filePath: newPath }
   ↓
8. Editor immediately updates filePathRef.current = result.filePath
   ↓
9. Editor dispatches setCurrentFilePath(result.filePath) to Redux
   ↓
10. Editor stores localStorage.setItem('lastOpenedFile', result.filePath)
   ↓
11. Editor dispatches setIsModified(false) to Redux
```

**Why this design**:
- filePathRef updated IMMEDIATELY so next Ctrl+S uses new path
- localStorage updated so restart reopens the newly-saved file

---

## Restart & Reload Last File Flow

**User Action**: Close and reopen app

```
1. App starts, Editor.js mounts
   ↓
2. useEffect reads localStorage.getItem('lastOpenedFile')
   ↓
3. If found, calls window.electronAPI.openEncryptedFileWithPath(lastFile)
   ↓
4. Electron reads file from disk, returns { success: true, filePath, content }
   ↓
5. Editor immediately updates filePathRef.current = result.filePath
   ↓
6. Editor calls setContent(result.content)
   ↓
7. Editor dispatches setCurrentFilePath(result.filePath) to Redux
   ↓
8. Editor calls parseText(result.content)
```

**Why this design**:
- Single source of truth: localStorage holds "last file path"
- Automatic reload improves UX
- filePathRef initialized correctly before any user interaction

---

## State Architecture

**Redux (Global State)**:
- `editorSlice.currentFilePath`: For window title display
- `editorSlice.isModified`: For window title "*" indicator
- Purpose: UI state that needs to be displayed outside Editor component

**Editor Local State**:
- `content`: Plain text representation for Monaco/textarea
- `viewMode`: Current editor view ('array' | 'monaco' | 'textarea')
- Purpose: View-specific state that doesn't need global access

**Refs (Synchronous State)**:
- `filePathRef`: Source of truth for save operations (avoids Redux async)
- `monacoRef`: Direct access to Monaco editor instance
- `textareaRef`: Direct access to textarea DOM element
- Purpose: Synchronous access for time-sensitive operations (Ctrl+S)

**editorEngine (Module State)**:
- Lines array: Parsed document structure for fold view
- Purpose: Shared state for fold/array view calculations

**Why this separation**:
- Redux for UI updates across components
- Refs for immediate operations that can't wait for React re-render
- Local state for component-specific views
- Module state for shared calculations

---

## Critical Design Decisions

### Why filePathRef instead of Redux?
**Problem**: Ctrl+S needs file path immediately, but Redux updates are async
**Solution**: Update filePathRef synchronously when file opened/saved
**Result**: No race condition, save always goes to correct file

### Why not pass content on every keystroke?
**Problem**: Passing full document (potentially MB) on every keystroke = O(n) per keystroke
**Solution**: Pass null, get content from ref when actually needed (save)
**Result**: Smooth typing, no lag

### Why debounce decorations in Monaco?
**Problem**: Iterating all lines to update decorations on every keystroke = O(n) per keystroke
**Solution**: Debounce to 300ms, only update when typing pauses
**Result**: Responsive editor, decorations still update

### Why capture phase for Ctrl+S?
**Problem**: Monaco captures Ctrl+S in bubble phase, preventing our handler from seeing it
**Solution**: Use capture phase (third argument `true` in addEventListener)
**Result**: Our handler runs first, prevents Monaco default, save works
