# AI Integration Feature

## Overview
User can send document sections to AI for suggestions. AI returns proposed changes that user can accept/reject individually.

---

## Use Case 1: Send Section to AI

### User Action
User right-clicks on chapter/section fold button → selects AI action from context menu

### Current Data Flow (PROBLEMATIC)

```
1. User right-clicks fold button
   ↓ WHERE: EditorLine.js
2. handleFoldContextMenu fires
   ↓
3. Calls onShowAIContextMenu(x, y, lineIdx) prop
   ↓ TRAVELS UP: EditorLine → FoldEditorView → Editor
4. Editor.showAIContextMenu()
   ↓
5. window.electronAPI.showAIContextMenu({ x, y, lineIdx, line })
   ↓ IPC: Renderer → Main
6. electron.js receives 'show-ai-context-menu'
   ↓
7. Creates native context menu with options
   ↓
8. User selects option from menu
   ↓
9. electron.js sends 'ai-context-choice' back to renderer
   ↓ IPC: Main → Renderer
10. Editor.js useEffect receives choice
   ↓
11. Editor applies AI mode change to line
   ↓
12. Editor calls dispatch(setIsModified(true))
```

**Issues**:
- ❌ onShowAIContextMenu is prop drilled through multiple components
- ❌ Editor is orchestrator when it should just handle the result
- ✓ Electron menu is correct (native UI)

**Correct Flow**:
```
1. User right-clicks fold button
   ↓ WHERE: EditorLine.js
2. EditorLine has lineIdx and line data
   ↓
3. EditorLine.showAIContextMenu(x, y, lineIdx, line)
   - Uses window.electronAPI directly (no props needed)
   ↓
4. electron.js shows menu, user selects
   ↓
5. electron.js broadcasts 'ai-context-choice' 
   ↓
6. EditorLine (or Editor) listens via useEffect
   ↓
7. Updates line, dispatches setIsModified(true) to Redux
```

---

## Use Case 2: AI Sends Suggestions Back

### User Action
AI processing completes, suggestions sent back to app

### Current Data Flow (EXTREMELY PROBLEMATIC)

```
1. AI service sends response to AISidebar
   ↓ WHERE: AISidebar.js
2. AISidebar processes changes
   ↓
3. AISidebar calls onAIResponse(newLines, processedChanges, allChangeIds)
   ↓ CALLBACK PROP DRILLING: AISidebar → App
4. App.handleAIResponse() executes
   ↓
5. App dispatches setAIChanges({ allChangeIds, processedChanges }) to Redux
   ↓
6. App calls editorRef.current.updateLinesFromAI(newLines)
   ↓ IMPERATIVE: App → Editor
7. Editor updates its internal lines array
   ↓
8. Editor re-renders with new lines
```

**Issues**:
- ❌ MAJOR: Why is App.js the middleman? This is BOOMERANG STATE!
- ❌ AISidebar should dispatch to Redux directly
- ❌ AISidebar should access editorRef via Context, not callback
- ❌ App.js has no business orchestrating this

**Correct Flow (SHOULD BE)**:
```
1. AI service sends response to AISidebar
   ↓ WHERE: AISidebar.js
2. AISidebar processes changes
   ↓
3. AISidebar dispatches setAIChanges({ allChangeIds, processedChanges })
   - Direct to Redux, NO CALLBACK
   ↓
4. AISidebar gets editorRef from EditorContext
   - const editorRef = useContext(EditorContext)
   ↓
5. AISidebar calls editorRef.current.updateLinesFromAI(newLines)
   - Direct imperative call, NO CALLBACK TO APP
   ↓
6. Editor updates lines and re-renders
```

**Why This is Better**:
- No prop drilling
- AISidebar is self-contained
- App.js is not involved (correct!)
- Redux used for state
- Context used for imperative API

---

## Use Case 3: User Accepts/Rejects Change

### User Action
User clicks accept/reject button on diff line

### Current Data Flow (PROBLEMATIC)

```
1. User clicks accept/reject button
   ↓ WHERE: DiffActionButtons.js
2. DiffActionButtons.handleAccept/handleReject
   ↓
3. Updates line in editorEngine (removes proposedChange*)
   ↓
4. Calls onUpdate() callback prop
   ↓ CALLBACK PROP DRILLING: DiffActionButtons → FoldEditorView → Editor → App
5. App.handleDiffUpdate() executes
   ↓
6. App calls editorRef.current.updateLinesFromAI(getLines())
   ↓
7. App dispatches setIsModified(true)
   ↓
8. Editor re-renders
```

**Issues**:
- ❌ MAJOR: Callback travels through 3 components to reach App
- ❌ Why is App orchestrating? DiffActionButtons should handle it
- ❌ DiffActionButtons directly imports editorEngine - breaks encapsulation

**Correct Flow (SHOULD BE)**:
```
1. User clicks accept/reject button
   ↓ WHERE: DiffActionButtons.js
2. DiffActionButtons gets editorRef from EditorContext
   ↓
3. DiffActionButtons calls editorRef.current.acceptChange(lineIdx)
   - Editor method handles the logic
   ↓
4. Editor updates line, removes proposal markers
   ↓
5. Editor dispatches setIsModified(true) to Redux
   ↓
6. Editor re-renders
```

**Why This is Better**:
- No callback prop drilling
- Editor owns the logic (correct encapsulation)
- DiffActionButtons doesn't touch editorEngine directly
- Redux used for state

---

## Use Case 4: Navigate Between Changes

### User Action
User clicks "Next Change" / "Previous Change" in DiffNavigation

### Current Data Flow (PROBLEMATIC)

```
1. User clicks navigation button
   ↓ WHERE: DiffNavigation.js
2. DiffNavigation dispatches setCurrentChangeId(id) to Redux
   ↓
3. Redux updates currentChangeIdIndex
   ↓
4. Editor receives currentChangeId prop
   ↓
5. Editor passes to FoldEditorView
   ↓
6. FoldEditorView passes to EditorLine
   ↓
7. EditorLine checks if line.proposedChangeId === currentChangeId
   ↓
8. EditorLine scrolls into view if match
```

**Issues**:
- ✓ Redux used correctly for state
- ✓ No callbacks needed
- ⚠️ Prop drilling through multiple components (Editor → FoldEditorView → EditorLine)
- Could use Context instead?

**This Flow is ACCEPTABLE** but could be improved:
- currentChangeId could be in Context instead of props
- EditorLine could read from Context directly

---

## Data Flow Summary

### Redux State (Global)
```javascript
{
  aiChanges: {
    allChangeIds: ['change1', 'change2', ...],
    processedChanges: { 
      'change1': { type: 'insert', lineIdx: 5, ... },
      'change2': { type: 'modify', lineIdx: 10, ... }
    },
    currentChangeIdIndex: 0
  }
}
```

**Who Updates**:
- AISidebar: Sets allChangeIds and processedChanges
- DiffNavigation: Updates currentChangeIdIndex

**Who Reads**:
- DiffNavigation: Reads for navigation buttons
- Editor/EditorLine: Reads for highlighting current change

---

## Issues to Fix

### CRITICAL: AISidebar callback to App
**Problem**: `onAIResponse` callback prop  
**Resolution**: Use EditorContext + direct Redux dispatch  
**Impact**: Removes handleAIResponse from App.js

### CRITICAL: DiffActionButtons callback chain
**Problem**: `onUpdate` callback through 3 components  
**Resolution**: EditorContext + Editor.acceptChange() method  
**Impact**: Removes handleDiffUpdate from App.js, simplifies DiffActionButtons

### MEDIUM: AI context menu prop drilling
**Problem**: `onShowAIContextMenu` prop drilled  
**Resolution**: EditorLine calls window.electronAPI directly  
**Impact**: Removes prop from FoldEditorView

---

## Correct Architecture

**AISidebar** (Self-contained):
```javascript
import { useDispatch } from 'react-redux';
import { useContext } from 'react';
import { setAIChanges } from '../store/aiChangesSlice';
import { EditorContext } from '../contexts/EditorContext';

function AISidebar() {
  const dispatch = useDispatch();
  const editorRef = useContext(EditorContext);
  
  const handleAIResponse = (newLines, processedChanges, allChangeIds) => {
    // Store in Redux
    dispatch(setAIChanges({ allChangeIds, processedChanges }));
    
    // Update editor
    editorRef.current?.updateLinesFromAI(newLines);
  };
  
  // ...rest of component
}
```

**DiffActionButtons** (Self-contained):
```javascript
import { useDispatch } from 'react-redux';
import { useContext } from 'react';
import { setIsModified } from '../store/editorSlice';
import { EditorContext } from '../contexts/EditorContext';

function DiffActionButtons({ proposedChangeId, changeType }) {
  const dispatch = useDispatch();
  const editorRef = useContext(EditorContext);
  
  const handleAccept = () => {
    // Editor handles the logic
    editorRef.current?.acceptChange(proposedChangeId);
    
    // Mark as modified
    dispatch(setIsModified(true));
  };
  
  // ...rest
}
```

**App.js** (Minimal):
```javascript
function App() {
  const editorRef = useRef(null);
  
  return (
    <EditorContext.Provider value={editorRef}>
      <Editor onEditorReady={(api) => editorRef.current = api} />
      <AISidebar />  {/* NO CALLBACK PROP */}
      <DiffNavigation />  {/* NO CALLBACK PROP */}
    </EditorContext.Provider>
  );
}
```

---

## Testing Checklist

After refactor:
- [ ] Send section to AI → suggestions appear
- [ ] Accept change → line updated, marked modified
- [ ] Reject change → proposal removed
- [ ] Navigate changes → correct line highlighted and scrolled
- [ ] Multiple changes → all handled correctly
- [ ] App.js has NO AI-related logic
