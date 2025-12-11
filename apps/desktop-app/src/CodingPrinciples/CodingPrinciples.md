# Coding Principles

## 1. Component Responsibility - Keep Functions Where They Belong

Functions should live in the component they are for. If a function is only used by a specific component, it should be defined inside that component or in a dedicated file for that component.

**Bad Example:**
```jsx
// EditorArray.js - cluttered with find-related functions
const handleFindNext = () => {
  if (findMatches.length === 0) return;
  setCurrentFindIndex(prev => (prev + 1) % findMatches.length);
};
```

**Good Example:**
```jsx
// FindBox.js - find functions live in the FindBox component
function FindBox({ visible, onClose, getEditorContainer }) {
  const handleNext = () => {
    if (matches.length === 0) return;
    setCurrentIndex(prev => (prev + 1) % matches.length);
  };
  // ... rest of FindBox
}
```

---

## 2. Avoid "Boomerang State"

Don't pass state and its setter from parent to child when the state could just live in the child. This creates unnecessary coupling.

**Bad Example (Boomerang State):**
```jsx
// Parent.js
const [isOpen, setIsOpen] = useState(false);
return <Modal isOpen={isOpen} setIsOpen={setIsOpen} />;

// Modal.js - receives state and setter but only uses them internally
function Modal({ isOpen, setIsOpen }) {
  // This state should just live here!
}
```

**Good Example:**
```jsx
// Parent.js
return <Modal />;

// Modal.js - owns its own state
function Modal() {
  const [isOpen, setIsOpen] = useState(false);
  // State lives where it's used
}
```

---

## 3. Use Redux When It Reduces Complexity

Use Redux for state that:
- Is used across many components (reduces prop drilling)
- Needs to be accessed from unrelated parts of the component tree
- Represents app-wide settings or configuration

**Good Redux Use Cases:**
- `viewType` (array vs monaco) - used by App, WebMenuBar, AISidebar
- `isAIEnabled` - used by many components
- `currentFilePath` - accessed across the app

**Bad Redux Use Case:**
- `findQuery` - only used within FindBox component

---

## 4. Parent-Child Communication Patterns

### Rule: Parent should NOT call child functions directly

**Bad Pattern:**
```jsx
// Parent calling child method directly
const childRef = useRef();
childRef.current.doSomething();
```

### Preferred Patterns:

**A. If both parent and child need the function, put it in parent:**
```jsx
// Parent.js
const handleSave = () => { /* save logic */ };
return <Editor onSave={handleSave} />;
```

**B. If only child needs the function, keep it in child:**
```jsx
// Child.js
const handleLocalAction = () => { /* only used here */ };
```

**C. Use Redux trigger flag pattern (when A and B don't work):**
```jsx
// editorSlice.js
saveTrigger: 0,
bumpSaveTrigger: (state) => { state.saveTrigger += 1; }

// Parent.js - dispatches trigger
dispatch(bumpSaveTrigger());

// Child.js - responds to trigger via useEffect
useEffect(() => {
  if (saveTrigger) handleSave();
}, [saveTrigger]);
```

---

## 5. useImperativeHandle - When It's Appropriate

Use `useImperativeHandle` sparingly. It's appropriate when:
- A parent MUST call specific methods on a child (e.g., external API integration)
- The child has internal state/logic that can't be lifted up

**Current legitimate use in EditorArray:**
```jsx
useImperativeHandle(ref, () => ({
  prepareForAI: () => getLines(),      // AISidebar needs lines for AI prompt
  updateLinesFromAI: (newLines) => {}, // AISidebar triggers re-render after AI
  getContent: () => getTextFromLines() // For save operations
}));
```

**WHY this is okay:** AISidebar is an external component that needs to interact with editor internals without knowing implementation details.

---

## 6. Avoid Unnecessary Prop Drilling

If you're passing props through multiple component levels, consider:
1. Redux for truly global state
2. React Context for component-tree-scoped state
3. Component composition (children prop pattern)

---

## Notes on Current Architecture

### EditorArray
- `isArrayView = true` is now a constant (EditorArray is always array view)
- View switching happens via Redux `viewType` in App.js
- Find functionality should eventually be extracted to FindBox component

### AI Integration
- Monaco uses `aiSlice` for proposals (view zones)
- EditorArray uses `aiChangesSlice` for proposals (line-embedded)