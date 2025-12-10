# View Modes Feature

## Overview
Editor supports three view modes:
- **Array View**: Fold/unfold chapters/sections with visual nesting
- **Monaco View**: Code editor with syntax highlighting
- **Textarea View**: Plain text with native spellcheck

---

## Use Case 1: Switch View Mode

### User Action
User clicks view mode toggle or uses keyboard shortcut

### Data Flow

```
1. User triggers view mode change
   ↓ SOURCE: Menu, keyboard shortcut, or button
2. Editor.switchToViewMode(newMode) called
   ↓ WHERE: Editor.js
3. Get current content from active view:
   - Array: getTextFromLines() from editorEngine
   - Monaco: monacoRef.current.getValue()
   - Textarea: textareaRef.current.value
   ↓
4. setContent(currentContent) - sync local state
   ↓
5. If switching TO array view:
   - parseText(currentContent) - parse into editorEngine lines
   - renderEditor() - force re-render
   ↓
6. setViewMode(newMode) - update local state
   ↓
7. localStorage.setItem('editorViewMode', newMode) - persist choice
   ↓
8. React re-renders with new view
```

**State Locations**:
- `viewMode` - Local state in Editor.js
- `content` - Local state in Editor.js (plain text)
- `lines` - Module state in editorEngine.js (parsed structure)

**Why Local State**:
- ✓ View mode is Editor-specific, no other component needs it
- ✓ Content is synchronized from whichever view is active
- ✓ No need for Redux here

**Issues**:
- ✓ Well-designed, no major issues
- ⚠️ localStorage used directly - could be abstracted

---

## Use Case 2: Content Sync Between Views

### Critical Requirement
Content must persist when switching views without data loss

### Array → Monaco Flow

```
1. User in array view, types text
   ↓
2. EditorLine updates line.text in editorEngine
   ↓
3. User switches to Monaco
   ↓
4. switchToViewMode('monaco') executes
   ↓
5. Calls getTextFromLines() - converts lines array to plain text
   ↓
6. setContent(plainText) - updates local state
   ↓
7. Monaco receives content prop
   ↓
8. Monaco displays text - NO DATA LOSS
```

### Monaco → Array Flow

```
1. User in Monaco, types text
   ↓
2. Monaco stores internally (not synced on every keystroke - performance!)
   ↓
3. User switches to array
   ↓
4. switchToViewMode('array') executes
   ↓
5. Calls monacoRef.current.getValue() - get current Monaco content
   ↓
6. setContent(monacoText) - updates local state
   ↓
7. parseText(monacoText) - parse into editorEngine lines
   ↓
8. Array view displays lines - NO DATA LOSS
```

**Key Design Decision**: 
Content is NOT synced on every keystroke in Monaco/Textarea for performance.  
Content is synced ONLY when:
1. Switching views
2. Saving file

**Why This Works**:
- ✓ Each view is source of truth while active
- ✓ Sync happens at view boundaries (not expensive)
- ✓ Save operation reads directly from active view

---

## Use Case 3: Fold/Unfold in Array View

### User Action
User clicks +/− button on chapter/section line

### Data Flow

```
1. User clicks fold button
   ↓ WHERE: EditorLine.js
2. handleFoldClick() fires
   ↓
3. Calls onToggleFold(lineIndex) prop
   ↓ PROP: EditorLine → FoldEditorView → Editor
4. Editor.toggleFold(idx) executes
   ↓
5. Get lines from editorEngine
   ↓
6. Toggle line.open state
   ↓
7. Update #folded tag on line.text to match state
   ↓
8. renderEditor() - triggers re-render
   ↓
9. dispatch(setIsModified(true)) - mark as modified
   ↓
10. getVisibleLines() recalculates which lines to show
   ↓
11. React re-renders FoldEditorView with new visible lines
```

**Issues**:
- ⚠️ onToggleFold prop drilled through FoldEditorView
- Could EditorLine access toggleFold via Context?
- Acceptable since EditorLine is tightly coupled to Editor

---

## Use Case 4: Fold All / Unfold All

### User Action
User clicks "Fold All" or "Unfold All" button

### Data Flow

```
1. User triggers fold all
   ↓ SOURCE: Menu or keyboard shortcut
2. Editor.foldAll() executes
   ↓ WHERE: Editor.js
3. Iterate all lines in editorEngine
   ↓
4. For each foldable line (startIdx !== -1):
   - Set line.open = false
   - Add #folded tag if not present
   ↓
5. If currently in Monaco view:
   - Call monacoRef.current.getAction('editor.foldAll').run()
   - Monaco has its own folding, keep in sync
   ↓
6. renderEditor() - force re-render
   ↓
7. dispatch(setIsModified(true)) - mark as modified
```

**Issues**:
- ⚠️ Monaco folding kept in sync manually
- Could be brittle if Monaco or editorEngine gets out of sync
- Consider: Single source of truth for fold state?

---

## Use Case 5: Monaco Decorations

### Purpose
Show visual indicators in Monaco (AI eyes, custom syntax)

### Data Flow

```
1. Monaco editor mounts
   ↓
2. handleEditorDidMount() executes
   ↓
3. Register custom folding provider for #chapter/#section
   ↓
4. Register custom language 'scribefold'
   ↓
5. Define custom theme with transparent background
   ↓
6. On every content change (DEBOUNCED 300ms):
   ↓
7. updateDecorations() executes
   ↓
8. Iterate all lines looking for #chapter/#section
   ↓
9. If AI enabled and line has #ai-hide:
   - Add grey eye icon in glyph margin
   ↓
10. If AI enabled and no #ai-hide:
   - Add colored eye icon in glyph margin
   ↓
11. Apply decorations to editor
```

**Performance Optimization**:
- Decorations update is DEBOUNCED to 300ms
- Prevents O(n) iteration on every keystroke
- Updates only when typing pauses

**Issues**:
- ✓ Well-designed performance optimization
- ⚠️ Could decorations be moved to Monaco worker thread?

---

## Use Case 6: View Mode Persistence

### Requirement
Last-used view mode should be restored on app restart

### Data Flow

```
1. User switches to Monaco view
   ↓
2. localStorage.setItem('editorViewMode', 'monaco')
   ↓
3. User closes app
   ↓
4. User reopens app
   ↓
5. Editor initializes
   ↓
6. useState initialization reads localStorage
   ↓
7. const saved = localStorage.getItem('editorViewMode')
   ↓
8. Initial viewMode set to 'monaco'
   ↓
9. Editor renders in Monaco view
```

**Also Listens for Changes**:
```
1. Settings modal changes view mode
   ↓
2. Updates localStorage
   ↓
3. Editor has useEffect listening for storage events
   ↓
4. Also polls localStorage every 500ms (handles same-window updates)
   ↓
5. When change detected, calls switchToViewMode(newMode, true)
   - true = skip localStorage update (came from there)
```

**Issues**:
- ⚠️ Polling every 500ms is inefficient
- Better: Settings modal calls editor method directly?
- Or: Settings uses Redux, Editor listens to Redux?

---

## State Architecture

### Local State in Editor.js

```javascript
// View mode - which view is active
const [viewMode, setViewMode] = useState('array' | 'monaco' | 'textarea');

// Content - plain text representation for Monaco/Textarea
const [content, setContent] = useState('');

// Render trigger - forces fold view re-render
const [renderTrigger, setRenderTrigger] = useState(0);
```

**Why Local**:
- These are view-specific to Editor component
- No other component needs to read viewMode
- Content is internal representation, not app state

### Module State in editorEngine.js

```javascript
// Lines array - parsed document structure
let lines = [];
```

**Why Module**:
- Shared between Editor and utility functions
- Not React state (doesn't trigger re-renders automatically)
- Editor controls when to read/write via utility functions

### Refs in Editor.js

```javascript
// Direct access to view DOM/instances
const monacoRef = useRef(null);  // Monaco editor instance
const textareaRef = useRef(null);  // Textarea DOM element
const editorRef = useRef(null);    // Fold view container
```

**Why Refs**:
- Imperative access without re-render
- Direct method calls (e.g., monacoRef.current.getValue())
- Essential for view switching and save operations

---

## Issues to Fix

### MEDIUM: localStorage Polling
**Problem**: Polls every 500ms for view mode changes  
**Resolution**: Settings should update Redux, Editor listens to Redux  
**Impact**: Better performance, cleaner architecture

### LOW: Monaco/EditorEngine Fold Sync
**Problem**: Two sources of fold state (Monaco internal + editorEngine)  
**Resolution**: Use Monaco as single source when in Monaco view?  
**Impact**: Less manual syncing, fewer bugs

---

## Correct Architecture

**This feature is mostly well-designed**:
- ✓ State in correct locations
- ✓ Clear view boundaries
- ✓ Performance optimized
- ✓ No unnecessary Redux usage

**Minor improvements needed**:
- Replace localStorage polling with Redux
- Consider single source for fold state

---

## Testing Checklist

- [ ] Switch array → monaco → content preserved
- [ ] Switch monaco → textarea → content preserved
- [ ] Switch textarea → array → parsed correctly
- [ ] Fold in array → switch to monaco → folds kept
- [ ] Edit in monaco → switch to array → changes appear
- [ ] Restart app → last view mode restored
- [ ] Monaco decorations update correctly (debounced)
- [ ] Fold all in monaco → syncs with array view
