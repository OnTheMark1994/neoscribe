# Web Menu Feature

## Overview
In web mode (browser), provides menu bar since native OS menu doesn't exist.  
In Electron mode, menu bar is hidden (native menu used instead).

---

## Use Case 1: New File (Web Mode)

### User Action
User clicks "File > New" in web menu bar

### Current Data Flow (PROBLEMATIC)

```
1. User clicks New button
   ↓ WHERE: WebMenuBar.js
2. WebMenuBar calls onNew() callback prop
   ↓ CALLBACK PROP DRILLING: WebMenuBar → App
3. App.handleWebNew() executes
   ↓ WHERE: App.js line 132
4. App checks isModified, shows confirm if needed
   ↓
5. App calls parseText('') - DIRECTLY MANIPULATES editorEngine
   ↓
6. App dispatches setCurrentFilePath(null) to Redux
   ↓
7. App dispatches setIsModified(false) to Redux
   ↓
8. App calls editorRef.current.updateLinesFromAI(getLines())
   ↓ IMPERATIVE: App → Editor
9. Editor updates and re-renders
```

**Issues**:
- ❌ CRITICAL: App.js calls parseText() - should NEVER touch editorEngine
- ❌ App.js gets lines via getLines() - editorEngine should be private to Editor
- ❌ Why is App.js doing this instead of Editor?
- ❌ Callback prop drilling WebMenuBar → App

**Correct Flow (SHOULD BE)**:

```
1. User clicks New button
   ↓ WHERE: WebMenuBar.js
2. WebMenuBar gets editorRef from EditorContext
   - const editorRef = useContext(EditorContext)
   ↓
3. WebMenuBar calls editorRef.current.newFile()
   - Direct method call, NO CALLBACK
   ↓ WHERE: Editor.js (new method)
4. Editor.newFile() checks isModified, shows confirm
   ↓
5. Editor calls parseText('') - INTERNAL to Editor
   ↓
6. Editor dispatches setCurrentFilePath(null)
   ↓
7. Editor dispatches setIsModified(false)
   ↓
8. Editor updates its state and re-renders
```

**Why This is Better**:
- Editor owns editorEngine (correct encapsulation)
- No callback prop drilling
- App.js doesn't touch editorEngine (correct separation)
- WebMenuBar directly calls what it needs

---

## Use Case 2: Open File (Web Mode)

### User Action
User clicks "File > Open" in web menu bar

### Current Data Flow (PROBLEMATIC)

```
1. User clicks Open button
   ↓ WHERE: WebMenuBar.js
2. WebMenuBar calls onOpen() callback prop
   ↓ CALLBACK PROP DRILLING: WebMenuBar → App
3. App.handleWebOpen() executes
   ↓ WHERE: App.js line 142
4. App calls uploadTextFile() - shows browser file picker
   ↓ UTILITY: webFileOps.js
5. Returns { success: true, fileName, content }
   ↓
6. App calls parseText(content) - DIRECTLY MANIPULATES editorEngine
   ↓
7. App dispatches setCurrentFilePath(fileName) to Redux
   ↓
8. App dispatches setIsModified(false) to Redux
   ↓
9. App calls editorRef.current.updateLinesFromAI(getLines())
   ↓
10. Editor updates and re-renders
```

**Issues**:
- ❌ CRITICAL: Same as New - App manipulating editorEngine
- ❌ Why is file upload handled by App instead of Editor?
- ❌ Callback prop drilling

**Correct Flow (SHOULD BE)**:

```
1. User clicks Open button
   ↓ WHERE: WebMenuBar.js
2. WebMenuBar gets editorRef from EditorContext
   ↓
3. WebMenuBar calls editorRef.current.openFile()
   - Direct method call, NO CALLBACK
   ↓ WHERE: Editor.js (new method for web)
4. Editor calls uploadTextFile() - shows file picker
   ↓
5. Editor receives { success, fileName, content }
   ↓
6. Editor calls parseText(content) - INTERNAL
   ↓
7. Editor dispatches to Redux
   ↓
8. Editor updates and re-renders
```

**Why This is Better**:
- All file operations in Editor (consistent with Electron mode)
- No callback prop drilling
- App.js doesn't handle file operations

---

## Use Case 3: Save File (Web Mode)

### User Action
User clicks "File > Save" in web menu bar

### Current Data Flow (THIN WRAPPER)

```
1. User clicks Save button
   ↓ WHERE: WebMenuBar.js
2. WebMenuBar calls onSave() callback prop
   ↓ CALLBACK PROP DRILLING: WebMenuBar → App
3. App.handleSave() executes
   ↓ WHERE: App.js line 85
4. App calls editorRef.current.saveFile()
   ↓ THIN WRAPPER - just wraps one method call
5. Editor handles save logic
```

**Issues**:
- ❌ Unnecessary wrapper - App.js just calls editorRef method
- ❌ Callback prop drilling
- ⚠️ Web mode save doesn't actually work (browser can't write to file system)
- Need to trigger download instead

**Correct Flow (SHOULD BE)**:

```
1. User clicks Save button
   ↓ WHERE: WebMenuBar.js
2. WebMenuBar gets editorRef from EditorContext
   ↓
3. WebMenuBar calls editorRef.current.saveFile() directly
   - NO CALLBACK, NO APP.JS INVOLVEMENT
   ↓
4. Editor handles save:
   - Electron: writes to file system
   - Web: triggers browser download
```

**Why This is Better**:
- No unnecessary wrapper
- WebMenuBar directly accesses what it needs
- App.js not involved

---

## Use Case 4: Fold All / Unfold All (Web Mode)

### User Action
User clicks "View > Fold All" in web menu bar

### Current Data Flow (DUPLICATED LOGIC)

```
1. User clicks Fold All
   ↓ WHERE: WebMenuBar.js
2. WebMenuBar calls onFoldAll() callback prop
   ↓ CALLBACK PROP DRILLING: WebMenuBar → App
3. App.handleWebFoldAll() executes
   ↓ WHERE: App.js line 154
4. App checks if editorRef.current.foldAll exists
   ↓
5. If exists: calls editorRef.current.foldAll()
   ↓ THEN RETURNS - this is the normal case
6. If not exists (why would this happen?): FALLBACK LOGIC
   ↓
7. App calls getLines() from editorEngine
   ↓
8. App iterates lines, sets .open = false, adds #folded
   ↓
9. App calls editorRef.current.updateLinesFromAI(lines)
```

**Issues**:
- ❌ Why is there fallback logic? Editor always has foldAll method
- ❌ Fallback duplicates fold logic that exists in Editor
- ❌ App.js directly manipulating editorEngine (again!)
- ❌ Callback prop drilling

**Correct Flow (SHOULD BE)**:

```
1. User clicks Fold All
   ↓ WHERE: WebMenuBar.js
2. WebMenuBar gets editorRef from EditorContext
   ↓
3. WebMenuBar calls editorRef.current.foldAll() directly
   - NO CALLBACK, NO FALLBACK
   ↓
4. Editor handles all fold logic
```

**Why This is Better**:
- No code duplication
- No fallback needed
- App.js not involved
- Single source of truth for fold logic

---

## Electron Mode vs Web Mode Inconsistency

### Electron Mode
```
User clicks native menu
  ↓
electron.js sends IPC event 'menu-save'
  ↓
Editor.js listens to event via window.electronAPI.onMenuSave
  ↓
Editor handles save directly
```

**App.js is NOT INVOLVED** ✓

### Web Mode (Current)
```
User clicks web menu
  ↓
WebMenuBar calls callback
  ↓
App.js wrapper function
  ↓
App.js calls editorRef method (or manipulates editorEngine)
  ↓
Editor handles save
```

**App.js IS INVOLVED** ❌

### Why This is Wrong
- **Inconsistent**: Electron mode bypasses App, Web mode goes through App
- **Unnecessary**: WebMenuBar could call Editor directly like Electron does
- **Violates encapsulation**: App.js touches editorEngine in web mode only

---

## Correct Architecture

### WebMenuBar (Self-contained)

```javascript
import { useContext } from 'react';
import { EditorContext } from '../contexts/EditorContext';

function WebMenuBar() {
  const editorRef = useContext(EditorContext);
  
  const handleNew = () => {
    editorRef.current?.newFile();
  };
  
  const handleOpen = () => {
    editorRef.current?.openFile();
  };
  
  const handleSave = () => {
    editorRef.current?.saveFile();
  };
  
  const handleSaveAs = () => {
    editorRef.current?.saveFileAs();
  };
  
  const handleFoldAll = () => {
    editorRef.current?.foldAll();
  };
  
  const handleUnfoldAll = () => {
    editorRef.current?.unfoldAll();
  };
  
  return (
    <div className="web-menu-bar">
      <button onClick={handleNew}>New</button>
      <button onClick={handleOpen}>Open</button>
      <button onClick={handleSave}>Save</button>
      {/* etc */}
    </div>
  );
}
```

**NO CALLBACK PROPS, NO APP.JS INVOLVEMENT**

### Editor (Handles Web Mode Too)

```javascript
// Add methods for web mode file operations
const newFile = () => {
  if (window.isModified && !window.confirm('Unsaved changes. Continue?')) return;
  parseText('');
  dispatch(setCurrentFilePath(null));
  dispatch(setIsModified(false));
  renderEditor();
};

const openFile = async () => {
  // In web mode
  if (isWeb()) {
    const result = await uploadTextFile();
    if (result.success) {
      parseText(result.content);
      dispatch(setCurrentFilePath(result.fileName));
      dispatch(setIsModified(false));
      renderEditor();
    }
    return;
  }
  
  // In Electron mode
  // ... existing openEncryptedFile logic
};

// Expose via onEditorReady
useEffect(() => {
  if (onEditorReady) {
    onEditorReady({
      newFile,
      openFile,
      saveFile: handleSave,
      saveFileAs: handleSaveAs,
      foldAll,
      unfoldAll,
      // ... other methods
    });
  }
}, [onEditorReady]);
```

**Editor handles BOTH modes, App.js is NOT INVOLVED**

---

## Issues to Fix

### CRITICAL: Remove all web menu handlers from App.js
**Current**: handleWebNew, handleWebOpen, handleWebFoldAll, handleWebUnfoldAll  
**Resolution**: Delete these, WebMenuBar uses EditorContext  
**Impact**: App.js ~50 lines shorter, cleaner architecture

### CRITICAL: Remove editorEngine access from App.js
**Current**: App.js imports parseText, getLines  
**Resolution**: Editor exposes methods, App never touches editorEngine  
**Impact**: Correct encapsulation, Editor owns its internal state

### CRITICAL: Add web file operation methods to Editor
**Current**: Web file ops in App.js  
**Resolution**: Add newFile(), openFile() to Editor API  
**Impact**: Consistent with Electron mode, Editor handles all file ops

### HIGH: Remove fallback logic from App.js
**Current**: handleWebFoldAll has fallback that duplicates Editor logic  
**Resolution**: Delete fallback, Editor always has foldAll method  
**Impact**: No code duplication, single source of truth

---

## Testing Checklist

After refactor:
- [ ] Web mode: New file works
- [ ] Web mode: Open file (upload) works  
- [ ] Web mode: Save triggers download
- [ ] Web mode: Fold All works
- [ ] Web mode: Unfold All works
- [ ] Electron mode: Still works (unchanged)
- [ ] App.js has NO web menu logic
- [ ] App.js does NOT import editorEngine
- [ ] WebMenuBar works without any callback props
