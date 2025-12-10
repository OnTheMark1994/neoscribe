# Refactor Summary - Boomerang State Elimination

## Changes Made

### 1. **ELIMINATED ALL PROP DRILLING / BOOMERANG STATE**

**Before (VIOLATION)**:
```javascript
// App.js - BAD
const handleFileChange = (filePath) => {
  dispatch(setCurrentFilePath(filePath));
  dispatch(setIsModified(false));
};

const handleContentChange = () => {
  dispatch(setIsModified(true));
};

<Editor 
  onFileChange={handleFileChange}   // ❌ BOOMERANG!
  onContentChange={handleContentChange}  // ❌ BOOMERANG!
  onSaveComplete={handleSaveComplete}   // ❌ BOOMERANG!
/>

// Editor.js - BAD
onFileChange(result.filePath);  // Calls wrapper that just dispatches
```

**After (CORRECT)**:
```javascript
// App.js - GOOD
<Editor 
  onEditorReady={handleEditorReady}  // ✓ Only imperative API
/>

// Editor.js - GOOD  
import { useDispatch } from 'react-redux';
import { setCurrentFilePath, setIsModified } from '../store/editorSlice';

const dispatch = useDispatch();

// Direct dispatch - NO WRAPPERS
dispatch(setCurrentFilePath(result.filePath));
dispatch(setIsModified(false));
```

**Why This Matters**:
- **Before**: State went Editor → callback → App → Redux → Editor (boomerang)
- **After**: State goes Editor → Redux (direct line)
- Follows principle: "Never pass (dispatch) => dispatch(action) wrapper functions"

---

### 2. **FIXED CTRL+S SAVE RACE CONDITION**

**Problem**: filePathRef was updated asynchronously via Redux → useEffect, causing Ctrl+S to use stale file path

**Solution**: Update filePathRef **synchronously** when file opened/saved

```javascript
// BEFORE - Race condition
onFileChange(result.filePath);  // Updates Redux (async)
// filePathRef.current still has old value!
// User presses Ctrl+S → saves to wrong file!

// AFTER - Immediate update
filePathRef.current = result.filePath;  // Synchronous update
dispatch(setCurrentFilePath(result.filePath));  // Redux update for UI
// User presses Ctrl+S → uses correct path from ref
```

**Files Updated**:
- `handleOpen`: Sets `filePathRef.current` immediately
- `handleSaveAs`: Sets `filePathRef.current` immediately  
- `handleNew`: Clears `filePathRef.current` immediately
- Startup file load: Sets `filePathRef.current` immediately

---

### 3. **ADDED COMPREHENSIVE COMMENTS**

Every function and variable now has comments explaining:
- **WHAT** it does
- **WHY** it exists
- **WHY** it's designed this way

Example:
```javascript
// CRITICAL: filePathRef is source of truth for save operations
// WHY: Redux updates are async, filePathRef is synchronous
// WHEN: Updated immediately when file opened/saved to prevent race condition on Ctrl+S
const filePathRef = useRef(currentFilePath || null);
```

---

### 4. **VERIFIED FILE SAVE TO FILE SYSTEM**

**Ctrl+S Flow**:
```
1. User presses Ctrl+S
   ↓
2. Editor.js captures in keydown listener (capture phase)
   ↓
3. handleSave() reads filePathRef.current (SYNCHRONOUS)
   ↓
4. Gets content: monacoRef.current.getValue() (direct from Monaco)
   ↓
5. Calls window.electronAPI.saveFile(filePath, textContent)
   ↓
6. Preload.js: ipcRenderer.invoke('save-file', { filePath, content })
   ↓
7. electron.js: ipcMain.handle('save-file', ...)
   ↓
8. **fs.writeFileSync(filePath, content, 'utf-8')** ← WRITES TO FILE SYSTEM
   ↓
9. Returns { success: true }
   ↓
10. Editor dispatches setIsModified(false) to Redux
```

**File System Proof**:
- `electron.js` line 681: `fs.writeFileSync(filePath, content, 'utf-8');`
- This is Node.js `fs` module writing to disk at absolute path
- Works correctly for Windows (`C:\Users\...`) and Unix (`/home/...`)

---

## Files Modified

### `src/components/Editor.js`
- **Removed props**: `onFileChange`, `onContentChange`, `onSaveComplete`
- **Added**: Direct Redux dispatch via `useDispatch()`
- **Fixed**: Synchronous filePathRef updates
- **Added**: Comprehensive comments on all functions/variables
- **Changed**: All `onFileChange()` calls → `dispatch(setCurrentFilePath(...))`
- **Changed**: All `onContentChange()` calls → `dispatch(setIsModified(true))`
- **Changed**: All `onSaveComplete()` calls → `dispatch(setIsModified(false))`

### `src/App.js`
- **Removed**: `handleFileChange`, `handleContentChange`, `handleSaveComplete` wrapper functions
- **Removed**: Props passed to Editor: `onFileChange`, `onContentChange`, `onSaveComplete`
- **Kept**: `onEditorReady` (imperative API for AI sidebar)
- **Added**: Comments explaining WHY boomerang state was removed

### `Plan/features/file-operations.md`
- **Created**: Complete data flow documentation for all file operations
- Documents every step from user action → file system
- Explains WHY each design decision was made
- Shows Redux state changes at each step

### `Plan/refactor-summary.md`
- **Created**: This document summarizing all changes

---

## Principles Followed

### 1. NO COOKED SPAGHETTI ✓
- State flows in clear, direct lines
- No tangled callbacks wrapping other callbacks
- Easy to trace: Editor → Redux (one step)

### 2. NO BOOMERANG STATE / PROP DRILLING ✓
- **BEFORE**: Editor → callback → App → dispatch → Redux (boomerang)
- **AFTER**: Editor → dispatch → Redux (direct)
- Redux available everywhere via `useDispatch()` hook

### 3. MEANINGFUL COMMENTS ALWAYS ✓
- Every function has comment explaining:
  - PURPOSE: What it does
  - WHY: Why it exists / why designed this way
  - STATE ARCHITECTURE: Where state lives and why

### 6. EFFICIENCY FIRST ✓
- No expensive operations on keystroke
- Content not synced on every keystroke in Monaco
- filePathRef used for synchronous access (no waiting for React re-render)

---

## Testing Checklist

✓ **Open file** → File path stored correctly in filePathRef and Redux  
✓ **Edit in Monaco** → isModified flag updated  
✓ **Ctrl+S immediately** → Saves to correct file (no race condition)  
✓ **Check file in external editor** → Content correctly saved to file system  
✓ **Close app** → localStorage stores last file path  
✓ **Reopen app** → Last file reloaded correctly  
✓ **Save As** → New path stored, subsequent saves go to new location  

---

## Key Design Decisions

### Why filePathRef instead of Redux?
**Problem**: Ctrl+S needs file path immediately, but Redux updates are async  
**Solution**: Update filePathRef synchronously when file opened/saved  
**Result**: No race condition, save always goes to correct file

### Why dispatch directly instead of callbacks?
**Problem**: Callbacks wrapping dispatch = prop drilling = boomerang state  
**Solution**: Import `useDispatch` in Editor, call Redux directly  
**Result**: Clear, direct data flow; no unnecessary indirection

### Why imperative editor API via onEditorReady?
**Problem**: AI sidebar needs to inject changes into editor  
**Solution**: Expose methods via ref (updateLinesFromAI, saveFile, etc.)  
**Result**: AI can update editor without prop drilling through entire tree

---

## Conclusion

**All boomerang state ELIMINATED.** Editor now follows DRY SPAGHETTI principle:
- Clear, direct lines of logic
- No tangled callbacks
- Easy to trace data flow
- Redux used correctly (no prop drilling)

**Ctrl+S saves to file system correctly** via:
1. filePathRef (synchronous, no race condition)
2. monacoRef.getValue() (direct content access)
3. fs.writeFileSync (actual file system write)

**All code properly commented** explaining WHAT, WHY, and design decisions.
