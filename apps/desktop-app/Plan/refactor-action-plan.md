# Refactor Action Plan

## Summary

**Current State**: App.js has 248 lines with many functions that violate coding principles  
**Target State**: App.js ~80 lines, all logic in correct components  
**Violations Found**: 9 functions in wrong locations, 1 global variable misuse

---

## Phase 1: Create EditorContext (FOUNDATION)

### Step 1.1: Create Context File

**File**: `src/contexts/EditorContext.js`

```javascript
import { createContext } from 'react';

// Context provides editorRef to components that need imperative Editor API
// WHY: Avoids prop drilling editorRef through component tree
// WHO USES: AISidebar, DiffActionButtons, DiffNavigation, WebMenuBar
export const EditorContext = createContext(null);
```

### Step 1.2: Provide Context in App.js

**File**: `src/App.js`

```javascript
import { EditorContext } from './contexts/EditorContext';

function App() {
  const editorRef = useRef(null);
  
  return (
    <EditorContext.Provider value={editorRef}>
      {/* All components can now access editorRef via useContext */}
      <Editor onEditorReady={(api) => editorRef.current = api} />
      <AISidebar />
      <DiffNavigation />
      <WebMenuBar />
    </EditorContext.Provider>
  );
}
```

**Files Changed**: 1  
**Lines Added**: ~10  
**Lines Removed**: 0  

---

## Phase 2: Refactor AISidebar (HIGH PRIORITY)

### Step 2.1: Update AISidebar to Use Context + Direct Dispatch

**File**: `src/components/AISidebar.js`

**Add imports**:
```javascript
import { useContext } from 'react';
import { useDispatch } from 'react-redux';
import { setAIChanges } from '../store/aiChangesSlice';
import { EditorContext } from '../contexts/EditorContext';
```

**Replace callback usage**:
```javascript
function AISidebar() {
  const dispatch = useDispatch();
  const editorRef = useContext(EditorContext);
  
  const handleAIResponse = (newLines, processedChanges, allChangeIds) => {
    // Dispatch directly to Redux - NO CALLBACK
    dispatch(setAIChanges({ allChangeIds, processedChanges }));
    
    // Access editor via context - NO CALLBACK
    if (editorRef.current?.updateLinesFromAI) {
      editorRef.current.updateLinesFromAI(newLines);
    }
  };
  
  // ... rest of component
}
```

### Step 2.2: Remove Callback Prop from App.js

**File**: `src/App.js`

**Remove**:
```javascript
// DELETE THIS ENTIRE FUNCTION
const handleAIResponse = (newLines, processedChanges, allChangeIds) => { ... };
```

**Update render**:
```javascript
// BEFORE
<AISidebar onAIResponse={handleAIResponse} />

// AFTER
<AISidebar />  // NO PROP
```

**Files Changed**: 2  
**Lines Added**: ~10 (AISidebar)  
**Lines Removed**: ~15 (App.js)  
**Net**: -5 lines, cleaner architecture  

---

## Phase 3: Refactor DiffNavigation/DiffActionButtons (HIGH PRIORITY)

### Step 3.1: Update DiffActionButtons

**File**: `src/components/DiffActionButtons.js`

**Current**: Uses callback prop `onUpdate` which travels through multiple components

**Add imports**:
```javascript
import { useContext } from 'react';
import { useDispatch } from 'react-redux';
import { setIsModified } from '../store/editorSlice';
import { EditorContext } from '../contexts/EditorContext';
```

**Remove editorEngine direct access, use Editor method**:
```javascript
function DiffActionButtons({ proposedChangeId, changeType }) {
  const dispatch = useDispatch();
  const editorRef = useContext(EditorContext);
  
  const handleAccept = () => {
    // Call Editor method - it handles the logic
    if (editorRef.current?.acceptChange) {
      editorRef.current.acceptChange(proposedChangeId);
    }
    
    // Dispatch directly to Redux - NO CALLBACK
    dispatch(setIsModified(true));
  };
  
  const handleReject = () => {
    if (editorRef.current?.rejectChange) {
      editorRef.current.rejectChange(proposedChangeId);
    }
    dispatch(setIsModified(true));
  };
  
  // ... rest
}
```

### Step 3.2: Add Methods to Editor API

**File**: `src/components/Editor.js`

**Add new methods**:
```javascript
const acceptChange = (proposedChangeId) => {
  const lines = getLines();
  const line = lines.find(l => l.proposedChangeId === proposedChangeId);
  if (!line) return;
  
  // Handle different change types
  if (line.proposedChangeType === 'insert') {
    // Keep the line, remove proposal markers
    delete line.proposedChangeType;
    delete line.proposedChangeId;
  } else if (line.proposedChangeType === 'delete') {
    // Remove the line
    const idx = lines.indexOf(line);
    lines.splice(idx, 1);
  } else if (line.proposedChangeType === 'modify') {
    // Accept the new text
    line.text = line.modifyTo;
    delete line.proposedChangeType;
    delete line.proposedChangeId;
    delete line.modifyFrom;
    delete line.modifyTo;
  }
  
  renderEditor();
};

const rejectChange = (proposedChangeId) => {
  const lines = getLines();
  const line = lines.find(l => l.proposedChangeId === proposedChangeId);
  if (!line) return;
  
  if (line.proposedChangeType === 'insert') {
    // Remove inserted line
    const idx = lines.indexOf(line);
    lines.splice(idx, 1);
  } else if (line.proposedChangeType === 'delete') {
    // Keep the line, remove proposal markers
    delete line.proposedChangeType;
    delete line.proposedChangeId;
  } else if (line.proposedChangeType === 'modify') {
    // Keep original text
    line.text = line.modifyFrom;
    delete line.proposedChangeType;
    delete line.proposedChangeId;
    delete line.modifyFrom;
    delete line.modifyTo;
  }
  
  renderEditor();
};

// Expose in onEditorReady
useEffect(() => {
  if (onEditorReady) {
    onEditorReady({
      // ... existing methods
      acceptChange,
      rejectChange,
    });
  }
}, [onEditorReady]);
```

### Step 3.3: Remove Callback from App.js

**File**: `src/App.js`

**Remove**:
```javascript
// DELETE THIS ENTIRE FUNCTION
const handleDiffUpdate = () => { ... };
```

**Update render**:
```javascript
// BEFORE
<DiffNavigation onUpdate={handleDiffUpdate} />

// AFTER
<DiffNavigation />  // NO PROP
```

**Files Changed**: 3  
**Lines Added**: ~50 (Editor methods)  
**Lines Removed**: ~30 (App.js + DiffActionButtons)  
**Net**: +20 lines, but correct encapsulation  

---

## Phase 4: Refactor WebMenuBar (HIGH PRIORITY)

### Step 4.1: Update WebMenuBar to Use Context

**File**: `src/components/WebMenuBar.js`

**Add imports**:
```javascript
import { useContext } from 'react';
import { EditorContext } from '../contexts/EditorContext';
```

**Remove all callback props, use context**:
```javascript
function WebMenuBar({ /* REMOVE ALL CALLBACK PROPS */ }) {
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
  
  const handleToggleView = () => {
    editorRef.current?.toggleFoldView();
  };
  
  // ... rest of component with direct calls
}
```

### Step 4.2: Add Web Mode Methods to Editor

**File**: `src/components/Editor.js`

**Add methods for web file operations**:
```javascript
import { isWeb } from '../utils/environment';
import { uploadTextFile } from '../utils/webFileOps';

const newFile = () => {
  // Check modified state
  const isModified = window.isModified || selectIsModified(store.getState());
  if (isModified && !window.confirm('You have unsaved changes. Continue?')) {
    return;
  }
  
  // Clear everything
  filePathRef.current = null;
  setContent('');
  parseText('');
  dispatch(setCurrentFilePath(null));
  dispatch(setIsModified(false));
  renderEditor();
};

const openFile = async () => {
  // In web mode, show upload dialog
  if (isWeb()) {
    const result = await uploadTextFile();
    if (result.success) {
      filePathRef.current = result.fileName;
      setContent(result.content);
      dispatch(setCurrentFilePath(result.fileName));
      dispatch(setIsModified(false));
      parseText(result.content);
      renderEditor();
    }
    return;
  }
  
  // In Electron mode, use existing open dialog logic
  handleOpen();
};

// Expose via onEditorReady
useEffect(() => {
  if (onEditorReady) {
    onEditorReady({
      // ... existing methods
      newFile,
      openFile,
    });
  }
}, [onEditorReady]);
```

### Step 4.3: Remove All Web Handlers from App.js

**File**: `src/App.js`

**Remove these functions**:
```javascript
// DELETE ALL OF THESE
const handleSave = () => { ... };
const handleSaveAs = () => { ... };
const handleWebNew = () => { ... };
const handleWebOpen = () => { ... };
const handleWebFoldAll = () => { ... };
const handleWebUnfoldAll = () => { ... };
const handleWebToggleArrayView = () => { ... };
```

**Update render**:
```javascript
// BEFORE
<WebMenuBar
  onNew={handleWebNew}
  onOpen={handleWebOpen}
  onSave={handleSave}
  onSaveAs={handleSaveAs}
  onFoldAll={handleWebFoldAll}
  onUnfoldAll={handleWebUnfoldAll}
/>

// AFTER
<WebMenuBar />  // NO PROPS
```

**Remove imports from App.js**:
```javascript
// DELETE THESE - App.js should NEVER import editorEngine
import { parseText, getLines } from './utils/editorEngine';
import { uploadTextFile } from './utils/webFileOps';
```

**Files Changed**: 3  
**Lines Added**: ~40 (Editor methods)  
**Lines Removed**: ~100 (App.js)  
**Net**: -60 lines!!!  

---

## Phase 5: Eliminate window.isModified (MEDIUM PRIORITY)

### Step 5.1: Find All Usages

**Search for**: `window.isModified`

**Found in**:
- App.js (beforeunload handler)
- Editor.js (multiple places)
- Possibly elsewhere

### Step 5.2: Replace with Redux

**In App.js**:
```javascript
// BEFORE
const handleBeforeUnload = (e) => {
  if (!window.isModified) return;
  e.preventDefault();
  e.returnValue = '';
};

// AFTER
const handleBeforeUnload = (e) => {
  if (!isModified) return;  // Use Redux selector
  e.preventDefault();
  e.returnValue = '';
};
```

**In Editor.js**: Remove all `window.isModified = ...` assignments, rely only on Redux

**Files Changed**: 2+  
**Lines Changed**: ~10  

---

## Phase 6: Remove AI Context Menu Prop Drilling (MEDIUM PRIORITY)

### Step 6.1: Update EditorLine

**File**: `src/components/EditorLine.js`

**Current**: Calls `onShowAIContextMenu` callback prop

**Change to**:
```javascript
const handleFoldContextMenu = (e) => {
  // Call Electron API directly - no prop needed
  if (window.electronAPI?.showAIContextMenu) {
    e.preventDefault();
    window.electronAPI.showAIContextMenu({
      x: e.clientX,
      y: e.clientY,
      lineIdx,
      line,
    });
  }
};
```

### Step 6.2: Remove Prop from Components

**Files**: FoldEditorView.js, Editor.js

**Remove**: `onShowAIContextMenu` prop entirely

**Files Changed**: 3  
**Lines Removed**: ~10  

---

## Final State: App.js

**After all refactors, App.js should be**:

```javascript
import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectIsAIEnabled, selectCurrentFilePath, selectIsModified } from './store/editorSlice';
import { EditorContext } from './contexts/EditorContext';
import Editor from './components/Editor';
import AISidebar from './components/AISidebar';
import DiffNavigation from './components/DiffNavigation';
import WebMenuBar from './components/WebMenuBar';
import LoadingScreen from './components/LoadingScreen';
import Menus from './components/Menus';
import { isElectron, isWeb } from './utils/environment';

/**
 * App.js - Minimal root orchestrator
 * 
 * RESPONSIBILITIES:
 * - Renders major sections (Editor, AISidebar, DiffNavigation, WebMenuBar)
 * - Provides EditorContext with editorRef
 * - Manages app-level side effects (window title, beforeunload)
 * - Detects settings window mode
 * 
 * NOT RESPONSIBLE FOR:
 * - File operations (Editor's job)
 * - editorEngine manipulation (Editor's job)
 * - Orchestrating callbacks (components use Context + Redux)
 */
function App() {
  // WHY HERE: Provides imperative Editor API via Context
  // WHY REF: Editor methods aren't serializable state
  // CORRECT LOCATION ✓
  const editorRef = useRef(null);
  
  // WHY HERE: For window title and conditionally rendering AI sidebar
  // CORRECT LOCATION ✓
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const currentFilePath = useSelector(selectCurrentFilePath);
  const isModified = useSelector(selectIsModified);
  
  // WHY HERE: Determines if this window is dedicated settings window
  // CORRECT LOCATION ✓
  const [isSettingsView, setIsSettingsView] = useState(false);

  // WHY HERE: App-level side effect - warns on tab close
  // CORRECT LOCATION ✓
  useEffect(() => {
    if (!isWeb()) return;
    
    const handleBeforeUnload = (e) => {
      if (!isModified) return;
      e.preventDefault();
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isModified]);

  // WHY HERE: App-level side effect - updates window title
  // CORRECT LOCATION ✓
  useEffect(() => {
    const fileName = currentFilePath
      ? currentFilePath.split(/[/\\\\]/).pop()
      : 'Untitled';
    document.title = `${isModified ? '* ' : ''}${fileName} - ScribeFold AI`;
  }, [currentFilePath, isModified]);

  // WHY HERE: Detects settings window on mount
  // CORRECT LOCATION ✓
  useEffect(() => {
    if ((window.location.hash === '#settings' || window.location.hash === '#settings-ai') && isElectron()) {
      setIsSettingsView(true);
    }
  }, []);

  // Settings window: render only Settings component
  if (isSettingsView && isElectron()) {
    return <Settings />;
  }

  return (
    <EditorContext.Provider value={editorRef}>
      <div className={`App ${isElectron() ? 'env-electron' : 'env-web'}`}>
        <LoadingScreen />
        <WebMenuBar />
        
        <div className="page-container">
          <div className="page">
            <Editor onEditorReady={(api) => editorRef.current = api} />
          </div>
        </div>
        
        {isAIEnabled && <AISidebar />}
        <DiffNavigation />
        
        <Menus />
      </div>
    </EditorContext.Provider>
  );
}

export default App;
```

**Final Stats**:
- **Lines**: ~80 (down from 248)
- **Functions**: 0 helper functions (all in correct components)
- **Imports**: No editorEngine, no file ops utilities
- **Props passed**: Only `onEditorReady` to Editor
- **Architecture**: Clean, minimal orchestration

---

## Verification Checklist

After completing all phases:

### Functionality
- [ ] Open file works (web and Electron)
- [ ] Save file works (web and Electron)
- [ ] New file works (web and Electron)
- [ ] AI suggestions work
- [ ] Accept/reject changes work
- [ ] Fold/unfold works
- [ ] View mode switching works
- [ ] Window title updates correctly
- [ ] Beforeunload warning works

### Code Quality
- [ ] App.js has NO editorEngine imports
- [ ] App.js has NO callback wrapper functions
- [ ] App.js < 100 lines
- [ ] Every component has WHY comments on each function/variable
- [ ] No window.isModified global variable
- [ ] No prop drilling (Context + Redux used correctly)

### Architecture
- [ ] EditorContext created and provided
- [ ] All components use Context for editorRef
- [ ] All components dispatch to Redux directly
- [ ] Editor owns all file operations
- [ ] Editor owns all editorEngine manipulation
- [ ] No callbacks passed from App to children

---

## Timeline Estimate

- **Phase 1** (EditorContext): 30 minutes
- **Phase 2** (AISidebar): 45 minutes
- **Phase 3** (DiffNavigation): 1 hour
- **Phase 4** (WebMenuBar): 1.5 hours
- **Phase 5** (window.isModified): 30 minutes
- **Phase 6** (AI context menu): 30 minutes

**Total**: ~4.5 hours for complete refactor

---

## Success Criteria

1. **App.js is minimal** (~80 lines)
2. **No prop drilling** (Context + Redux used correctly)
3. **Correct encapsulation** (Editor owns editorEngine)
4. **Consistent architecture** (Web mode same as Electron mode)
5. **All comments explain WHY** (not just WHAT)
6. **No global variables** (Redux for all state)
7. **All tests pass** (functionality preserved)
