# Code Issues & Resolutions

**IMPORTANT**: See `common-issues.md` for patterns of what was done wrong and correct approaches.

## Status

**Documented**: All issues identified with detailed resolutions  
**Comments Added**: App.js has comprehensive comments on every variable/function  
**Comments Needed**: Editor.js and all other components need same level of detail  
**Implementation**: See `refactor-action-plan.md` for step-by-step fixes

---

## Critical Issues

### ISSUE 1: handleAIResponse in App.js (WRONG LOCATION)
**Current**: AISidebar → handleAIResponse callback → App.js → dispatch + editorRef  
**Problem**: Violates "no prop drilling" - why pass callback when Redux exists?  
**Root Cause**: AISidebar shouldn't need App as middleman

**Resolution**:
1. AISidebar should dispatch `setAIChanges` directly to Redux
2. Create EditorContext with editorRef, provide at App level
3. AISidebar uses `useContext(EditorContext)` to get editorRef
4. **Remove handleAIResponse from App.js entirely**

**Why This is Better**:
- No callback prop drilling
- AISidebar is self-contained
- Redux used correctly for state
- Context used correctly for imperative API

---

### ISSUE 2: handleSave/handleSaveAs in App.js (THIN WRAPPERS)
**Current**: WebMenuBar → callback → App.js → editorRef.saveFile()  
**Problem**: Unnecessary indirection - App.js just wraps editorRef method call  
**Root Cause**: WebMenuBar doesn't have access to editorRef

**Resolution**:
1. Create EditorContext with editorRef
2. WebMenuBar uses `useContext(EditorContext)` 
3. WebMenuBar calls `editorRef.current.saveFile()` directly
4. **Remove handleSave/handleSaveAs from App.js entirely**

**Why This is Better**:
- No unnecessary wrapper functions
- Direct access where needed
- Follows "dry spaghetti" principle

---

### ISSUE 3: handleWebNew/handleWebOpen in App.js (WRONG LOGIC LOCATION)
**Current**: App.js calls `parseText()`, `dispatch()`, `editorRef.updateLinesFromAI()`  
**Problem**: App.js manipulating editorEngine directly - this is Editor's responsibility  
**Root Cause**: Web mode file operations not handled by Editor

**Resolution**:
1. Add `openFileContent(content, fileName)` method to Editor's imperative API
2. Add `newFile()` method to Editor's imperative API
3. WebMenuBar calls these methods via EditorContext
4. **Move parseText/dispatch logic INTO Editor methods**

**Why This is Better**:
- Editor owns all file operations
- App.js doesn't touch editorEngine
- Consistent with Electron mode (Editor handles everything)

---

### ISSUE 4: handleDiffUpdate in App.js (QUESTIONABLE LOCATION)
**Current**: DiffNavigation → callback → App.js → editorRef + dispatch  
**Problem**: Why does App.js orchestrate this?  
**Root Cause**: DiffNavigation needs both editorRef and Redux dispatch

**Resolution**:
1. DiffNavigation uses EditorContext to get editorRef
2. DiffNavigation uses `useDispatch()` to dispatch directly
3. DiffNavigation calls `editorRef.current.updateLinesFromAI()` directly
4. **Remove handleDiffUpdate from App.js entirely**

**Why This is Better**:
- DiffNavigation is self-contained
- No callback prop drilling
- Follows Redux best practices

---

### ISSUE 5: handleWebFoldAll/handleWebUnfoldAll (DUPLICATED LOGIC)
**Current**: App.js has fallback logic for fold operations  
**Problem**: Duplicates fold logic that already exists in Editor  
**Root Cause**: Unclear why fallback needed

**Resolution**:
1. Editor's foldAll/unfoldAll should always work
2. WebMenuBar calls via EditorContext
3. **Remove fallback logic from App.js**

**Why This is Better**:
- No code duplication
- Single source of truth in Editor

---

### ISSUE 6: Missing Comments on Variables
**Current**: Many variables lack "WHY HERE" justification  
**Problem**: Violates Principle 3 - "MEANINGFUL COMMENTS ALWAYS"

**Missing Comments**:
- `editorRef` - Why useRef? Why not Redux? Why in App?
- `isSettingsView` - Why local state? Why not Redux?
- `dispatch` - Why needed in App at all?
- All useEffect blocks need "WHY IN APP.JS" justification

**Resolution**: Add comprehensive comments to every variable/function

---

### ISSUE 7: Web vs Electron Mode Inconsistency
**Current**: 
- Electron: Editor handles all file operations internally
- Web: App.js handles file operations externally

**Problem**: Inconsistent architecture between modes  
**Root Cause**: Web mode lacks file system, so different implementation

**Resolution**:
1. Create unified `fileOperations` module for web mode
2. Editor uses same internal flow for both modes
3. App.js doesn't handle file operations differently

**Why This is Better**:
- Consistent code paths
- Easier to maintain
- No mode-specific logic scattered around

---

### ISSUE 8: editorEngine Accessed Outside Editor
**Current**: App.js imports and calls `parseText()`, `getLines()`  
**Problem**: editorEngine is Editor's internal state - App shouldn't touch it  
**Root Cause**: Web mode file operations bypass Editor

**Resolution**:
- ALL editorEngine access should go through Editor methods
- App.js should never import from editorEngine
- Editor exposes methods like `openFileContent()`, `newFile()`

**Why This is Better**:
- Clear module boundaries
- editorEngine encapsulated in Editor
- Easier to refactor editor internals

---

### ISSUE 9: window.isModified Global Variable
**Current**: `window.isModified` used in multiple places  
**Problem**: Global state when Redux exists  
**Location**: App.js line 102, Editor.js multiple places

**Resolution**:
1. Remove all `window.isModified` usage
2. Use Redux `selectIsModified` everywhere
3. Electron IPC can query Redux if needed

**Why This is Better**:
- Single source of truth (Redux)
- No global pollution
- Easier to track state changes

---

## Architecture Proposal

### Correct Component Responsibilities

**App.js** (Minimal orchestrator):
- Renders major sections (Editor, AISidebar, DiffNavigation)
- Provides EditorContext with editorRef
- Handles app-level side effects (window title, beforeunload)
- **NO file operations**
- **NO editorEngine access**
- **NO callback orchestration**

**Editor.js** (File & Editor Operations):
- ALL file operations (new, open, save, save-as)
- ALL editorEngine manipulation
- ALL view mode switching
- Exposes imperative API via onEditorReady
- Dispatches to Redux for global state
- **NO callbacks to parent**

**AISidebar.js** (AI Operations):
- Sends AI requests
- Receives AI responses
- Uses EditorContext to access editorRef
- Dispatches to Redux directly
- **NO callbacks to parent**

**DiffNavigation.js** (Diff UI):
- Renders accept/reject buttons
- Uses EditorContext to access editorRef
- Dispatches to Redux directly
- **NO callbacks to parent**

**WebMenuBar.js** (Web UI):
- Renders menu buttons
- Uses EditorContext to access editorRef
- Calls editor methods directly
- **NO callbacks to parent**

---

## Implementation Priority

### Phase 1: Create EditorContext (HIGH PRIORITY)
1. Create `src/contexts/EditorContext.js`
2. App.js provides context with editorRef
3. Update all components to use context

### Phase 2: Remove All Callbacks from App.js (HIGH PRIORITY)
1. AISidebar: Use context + dispatch
2. DiffNavigation: Use context + dispatch  
3. WebMenuBar: Use context directly
4. **Delete all handle* functions from App.js**

### Phase 3: Move Web File Operations to Editor (MEDIUM PRIORITY)
1. Add `openFileContent()`, `newFile()` to Editor API
2. Move parseText/dispatch logic into Editor
3. Remove editorEngine imports from App.js

### Phase 4: Eliminate window.isModified (MEDIUM PRIORITY)
1. Find all usages
2. Replace with Redux selector
3. Remove global variable

### Phase 5: Add Missing Comments (HIGH PRIORITY)
1. Every variable needs "WHY HERE" comment
2. Every function needs "WHY IN THIS COMPONENT" comment
3. Justify or move each piece

---

## Justification Questions to Answer

For every function and variable in every component:
1. **WHAT** does it do?
2. **WHY** does it exist?
3. **WHY** is it in THIS component and not elsewhere?
4. **WHAT** would break if we moved it?
5. **IS THERE** a better place for it?

If you cannot strongly justify why something is where it is, **it's in the wrong place**.

---

## Files Requiring Complete Refactor

1. **App.js** - Remove most logic, keep minimal orchestration
2. **AISidebar.js** - Add context usage, remove callback
3. **DiffNavigation.js** - Add context usage, remove callback
4. **WebMenuBar.js** - Add context usage, remove callbacks
5. **Editor.js** - Add web file operation methods

---

## Expected Result

**App.js should be ~100 lines max**:
```javascript
function App() {
  const editorRef = useRef(null);
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const currentFilePath = useSelector(selectCurrentFilePath);
  const isModified = useSelector(selectIsModified);
  
  // Window title sync
  useEffect(() => { /* update title */ }, [currentFilePath, isModified]);
  
  // Beforeunload warning (web only)
  useEffect(() => { /* warn on close */ }, [isModified]);
  
  return (
    <EditorContext.Provider value={editorRef}>
      <WebMenuBar />
      <Editor onEditorReady={(api) => editorRef.current = api} />
      <AISidebar />
      <DiffNavigation />
    </EditorContext.Provider>
  );
}
```

**All logic in correct components, no prop drilling, clean architecture.**
