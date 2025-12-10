# Common Issues - Anti-Patterns Found

Short, opinionated guide to recurring problems in this codebase.

## Summary of Issues

- **1. Boomerang State** – Child calls parent just so parent can dispatch.
- **1b. Per‑Keystroke Data Updates** – Mutating big structures on every keypress.
- **1c. Wrong View Mode Work** – Doing array work while in Monaco view (and vice‑versa).
- **1d. Missing Early Returns** – Running expensive work before basic checks.
- **3. Thin Wrapper Functions** – Functions that only call another function.
- **4. Duplicated Logic** – Same behavior implemented in multiple places.
- **5. Insufficient Comments** – No explanation of WHAT/WHY/WHY HERE.
- **6. Wrong Separation of Concerns** – Same feature split across files by environment.
- **7. Globals Instead of Redux** – Using `window.*` as shared state.
- **9. State Duplication (Not DRY)** – Multiple sources of truth with no clear purpose.
- **10. Missing Justification in Components** – Extra components with no reason.
- **11. Parents/Menus Calling Child Functions** – Menus reaching down into component internals.

Each section below keeps a **very short summary**, with optional extra details collapsed.

---

## 1. Boomerang State (Callback Prop Drilling)

**Summary**: Don’t pass callbacks that only exist to call `dispatch`. Let the child dispatch directly.

<details>
<summary>Details & example</summary>

**Wrong**

```javascript
// Parent
const handleAction = () => dispatch(action());
<Child onAction={handleAction} />

// Child
props.onAction(); // Just bounces back to parent
```

**Right**

```javascript
// Child
import { useDispatch } from 'react-redux';
const dispatch = useDispatch();
dispatch(action());
```

Pattern: child knows *what* should happen → child dispatches action directly.

</details>

---

## 1b. Updating Data Structures on Every Keystroke

**Summary**: Typing should update fast DOM state only; sync big arrays/text once when needed.

<details>
<summary>Details & example</summary>

**Wrong**

```javascript
content.oninput = (e) => {
  const lines = getLines();
  lines[idx].text = e.target.textContent; // Every keypress
  dispatch(setIsModified(true));
};
```

**Right**

```javascript
content.oninput = () => {
  dispatch(setIsModified(true)); // Mark dirty only
};

// On save / view switch
syncDomToEditorEngine();
```

Pattern: “uncontrolled” DOM + **lazy sync** on save/view‑change.

</details>

---

## 1c. Running Expensive Operations in Wrong View Mode

**Summary**: Check view mode first; skip work that doesn’t apply.

<details>
<summary>Details & example</summary>

**Wrong**

```javascript
const foldAll = () => {
  // ❌ ALWAYS runs array operations, even in Monaco view
  const lines = getLines(); // O(n) - gets entire array
  lines.forEach(line => { // O(n) - loops through ALL lines
    line.open = false;
    line.text = line.text.trim() + ' #folded';
  });

  // Then ALSO runs Monaco operation
  if (viewMode === 'monaco') {
    monacoRef.current.getAction('editor.foldAll').run();
  }
  renderEditor(); // Unnecessary re-render
};
```

**Problem**: Wastes CPU on array operations that Monaco doesn't even use.

**Right**

```javascript
const foldAll = () => {
  // ✅ Check view mode FIRST
  if (viewMode === 'monaco') {
    monacoRef.current?.getAction('editor.foldAll')?.run();
    return; // ✅ Early return - skip all array work
  }

  // ✅ Only runs array operations when actually needed
  const lines = getLines();
  lines.forEach(line => {
    line.open = false;
    line.text = line.text.trim() + ' #folded';
  });
  renderEditor();
};
```

Rule: *"Check before you compute"*. Always validate conditions BEFORE expensive operations.

</details>

---

## 1d. Missing Early Returns Before Expensive Operations

**Summary**: Do cheap validation first, then heavy work.

<details>
<summary>Details & example</summary>

```javascript
// Right
const processData = () => {
  if (!shouldProcess) return; // Fast exit

  const data = expensiveOperation();
  const transformed = transform(data);
  useData(transformed);
};
```

Examples of “expensive”: large array loops, DOM queries, regex on big strings, file I/O, API calls.

</details>

---

## 3. Thin Wrapper Functions

**Summary**: Don’t create functions that only call another function once.

<details>
<summary>Details & example</summary>

**Wrong**

```javascript
// Parent
const handleSave = () => editorRef.current?.saveFile();
<Child onSave={handleSave} />;
```

**Right**

```javascript
// Child
const editorRef = useContext(EditorContext);
editorRef.current?.saveFile();
```

If a wrapper adds zero behavior, remove it.

</details>

---

## 4. Duplicated Logic (Fallback Code)

**Summary**: Keep each behavior implemented in one place.

<details>
<summary>Details & example</summary>

**Wrong**

```javascript
// App.js
const foldAll = () => {
  if (editorRef.current?.foldAll) editorRef.current.foldAll();
  else lines.forEach(l => l.open = false); // Duplicate logic
};
```

**Right**

```javascript
// App.js
editorRef.current?.foldAll();

// Editor.js (single source of truth)
const foldAll = () => {
  lines.forEach(l => l.open = false);
};
```

Pattern: trust the one owner of the behavior.

</details>

---

## 5. Insufficient Comments

**Summary**: Comments must explain WHAT, WHY, and WHY HERE.

<details>
<summary>Details & example</summary>

Good header comment should cover:

- What this ref/state/component represents.
- Why it exists (problem it solves).
- Why it lives in this file/scope.

```javascript
// WHAT: Reference to Editor imperative API (saveFile, foldAll, ...)
// WHY REF: Functions are not serializable (can’t live in Redux).
// WHY HERE: App passes it via Context to menu + sidebars.
const editorRef = useRef(null);
```

</details>

---

## 6. Wrong Separation of Concerns

**Summary**: Same feature should live in one place; env‑specific branches inside.

<details>
<summary>Details & example</summary>

**Wrong** – web vs Electron split across files:

```javascript
// App.js
const handleWebOpen = async () => { /* web open */ };

// Editor.js
const handleOpen = async () => { /* Electron open */ };
```

**Right** – single owner:

```javascript
const openFile = async () => {
  const result = isWeb() ? await uploadTextFile()
                         : await electronAPI.openFile();
  parseText(result.content);
};
```

</details>

---

## 7. Global Variables Instead of Redux

**Summary**: Avoid `window.*` as shared state; use Redux.

<details>
<summary>Details & example</summary>

**Wrong**

```javascript
window.isModified = true;
```

**Right**

```javascript
import { setIsModified } from './store/editorSlice';
dispatch(setIsModified(true));
```

Use globals only when Redux truly can’t represent the data.

</details>

---

## 9. State Duplication (Not DRY)

**Summary**: Multiple copies of the same fact are OK only if each has a clear role.

<details>
<summary>Details & example</summary>

**Good pattern**

```javascript
// Redux: currentFilePath – drives UI.
// localStorage: 'lastOpenedFile' – persistence across launches.
// filePathRef: sync cache – immediate value for Ctrl+S.
```

Each layer exists for a reason and is kept in sync on purpose.

</details>

---

## 10. Missing Justification in Components

**Summary**: Every component should justify its existence.

<details>
<summary>Details & example</summary>

Header comment should answer:

- Why is this its own component and not inline?
- What state does it own vs read from Redux?
- How do other components depend on it?

Without that, future changes become guesswork.

</details>

---

## 11. Parents / Menus Calling Child Component Functions

**Summary**: Parents/menus should not reach into child internals to call methods.

<details>
<summary>Details & example</summary>

**Wrong** – menu calls `Editor` methods via Context:

```javascript
// Editor.js
useEffect(() => {
  if (onEditorReady) {
    onEditorReady({ openFile, saveFile });
  }
}, [onEditorReady]);

// WebMenuBar.js
const editorRef = useContext(EditorContext);
editorRef.current?.openFile();
```

**Right** – shared layer and Redux:

```javascript
// fileOps.js
export async function openFileWithDialogs(env, deps) { /* ... */ }

// WebMenuBar.js
const result = await openFileWithDialogs(env, deps);
if (result?.success) {
  dispatch(fileOpened({ filePath: result.filePath, content: result.content }));
}

// Editor.js / EditorNew.js
// Reads content + currentFilePath from Redux and just renders.
```

Rule: parents/menus decide *what* happens; shared modules do *how*; components focus on UI.

</details>

---

## Correct Flow Patterns (Quick Reference)

### File Path Persistence

```javascript
1. User opens file
2. Update filePathRef (sync) for saves
3. Dispatch setCurrentFilePath(path) → Redux
4. Save localStorage.setItem('lastOpenedFile', path)
5. On app restart: read localStorage → Redux → UI updated
```

### Component Communication

```javascript
Child needs to call parent behavior:
  ✓ Use Context or shared module
  ✗ Prop callback that just wraps dispatch

Child needs parent/global state:
  ✓ Read from Redux directly
  ✗ Parent passes it down if many levels deep
```

### State Location Decision Tree

```javascript
Is it serializable?
  No → useRef (functions, DOM nodes)
  Yes ↓

Do multiple components need it?
  Yes → Redux
  No ↓

Does parent need it for render logic?
  Yes → Redux or lift to parent
  No → Local state in component
```

---

## Ridiculous Issues

Things that make you go "what were they thinking?"

### Polling localStorage Every 500ms

**Wrong**

```javascript
const interval = setInterval(() => {
  const saved = localStorage.getItem('editorViewMode');
  if (saved !== viewMode) {
    switchToViewMode(saved);
  }
}, 500); // Checking 120 times per minute!
```

**Right**

```javascript
// Put it in Redux, listen to Redux changes
const viewMode = useSelector(selectViewMode);

useEffect(() => {
  switchToViewMode(viewMode);
}, [viewMode]);
```

Rule: **Never poll. Use events, Redux, or React state.**
