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
- **12. Inline Styles in React Components** – Styling logic baked into JS instead of feature CSS.
- **13. Unnecessary Providers** – Adding React Context for values that can be passed one level via props.

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

### 1a. Prop-Drilling Redux Values Into Components

**Summary**: Don’t pass Redux-derived flags/coords/labels through multiple parents just so a component can render; let the component read Redux directly.

**Wrong**

```jsx
// App.js
const aiMenu = useSelector(selectAiContextMenu);

{aiMenu.visible && aiMenu.source === 'monaco' && (
  <AiContextMenu
    visible={aiMenu.visible}
    x={aiMenu.x}
    y={aiMenu.y}
    level={aiMenu.level}
  />
)}
```

**Right**

```jsx
// App.js
<AiContextMenu />

// AiContextMenu.js
const aiMenu = useSelector(selectAiContextMenu);
if (!aiMenu.visible) return null;
```

Rule: if a component’s behavior is entirely driven by Redux, it should **connect to Redux itself** instead of receiving those values via props from intermediates.

### 1c. Parent Editor Defining Child-Only Redux Functions

**Summary**: Don’t define Redux-dispatching helpers in a parent (e.g. `EditorArray`) when they’re only ever used by a single child (e.g. `EditorLine`). This is Boomerang State in disguise and clutters the parent.

**Wrong**

```jsx
// EditorArray.js
const handleShowAIContextMenu = (clientX, clientY, lineIdx) => {
  const lines = getLines();
  const line = lines && typeof lineIdx === 'number' ? lines[lineIdx] : null;
  const level = line && typeof line.level === 'number' ? line.level : 0;
  const lineKey = line && (line.id || lineIdx);

  dispatch(showAiContextMenu({
    x: clientX,
    y: clientY,
    level,
    source: 'array',
    lineKey,
  }));
};

<EditorLine
  ...
  onShowAIContextMenu={handleShowAIContextMenu}
/>;
```

Here:

- `EditorArray` knows **too much** about per-line AI behavior.
- The function only exists to be immediately called by `EditorLine`.
- The parent file gets longer and harder to scan for its real responsibilities (folding, save, find, etc.).

**Right**

```jsx
// EditorLine.js – child both computes AND dispatches
import { useDispatch } from 'react-redux';
import { showAiContextMenu } from '../../store/aiUiSlice';

function EditorLine({ line, lineIndex, ... }) {
  const dispatch = useDispatch();

  const handleFoldContextMenu = (e) => {
    if (line.level !== 1 && line.level !== 2) return; // Only headers
    e.preventDefault();

    const lines = getLines();
    const fullLine = lines && lines[lineIndex];
    const level = fullLine?.level ?? line.level ?? 0;
    const lineKey = fullLine?.id ?? lineIndex;

    dispatch(showAiContextMenu({
      x: e.clientX,
      y: e.clientY,
      level,
      source: 'array',
      lineKey,
    }));
  };
}
```

Rule: **the component that owns the interaction should own the dispatch**. Parent editors (`EditorArray`, `App`) stay short and focused; line components handle their own per-line Redux work.

Corollary: Redux actions should encapsulate their own calculation logic. Callers should dispatch **intents**, not do all the math inline. Example: when switching views, `App` should simply dispatch `hideAiContextMenu()` ("close any open AI menus") instead of manually poking at menu state fields; the reducer owns how that happens.

#### Extended Example: AI Context Menu Refactor

- **Old way (what went wrong)**
  - **Duplicated menu logic in both editors**
    - `EditorArray` defined `handleShowAIContextMenu` and passed it down.
    - `SimpleMonaco` had its own separate coordinate + level logic.
    - Two places to update whenever menu behavior changed.
  - **Incorrect positioning math in each editor**
    - Array view measured from the editor container sometimes, sometimes from the window.
    - Monaco used its own `getBoundingClientRect` offsets.
    - Result: menu opened ~100px off in some cases and behaved differently per view.
  - **Inline CSS and layout in JS**
    - Menu styles lived as inline style objects inside components.
    - Harder to scan and tweak; no single CSS owner for the menu.
  - **Prop-drilled Redux state and actions**
    - `App` + `EditorArray` pulled Redux state and passed flags/coords down as props.
    - Parents contained AI-menu-specific code that only the child actually used.
  - **Redux actions in the wrong place**
    - Parents did the line/level lookups and built payloads.
    - Call sites knew menu internals instead of just expressing "open menu here".
  - **Bloated Redux state with unused fields**
    - Early versions carried extra fields like `source` / `lineKey` that were never read.
    - These made the slice harder to scan without adding any real behavior.

  **Old code (simplified)**

  ```jsx
  // App.js – parent defines child-only helper and passes it down
  const showAIContextMenu = (x, y, lineIdx) => {
    const lines = getLines();
    const line = lines[lineIdx];

    if (window.electronAPI && window.electronAPI.showAIContextMenu && line) {
      window.electronAPI.showAIContextMenu({
        lineIdx,
        sendToAI: line.sendToAI,
        level: line.level,
        isOpen: line.open,
      });
    }
    // In web mode or without Electron bridge, do nothing for now
  };

  <EditorArray ref={editorRef} onShowAIContextMenu={showAIContextMenu} />;

  // EditorArray.js – parent computes and renders menu
  const [aiMenuVisible, setAiMenuVisible] = useState(false);
  const [aiMenuX, setAiMenuX] = useState(0);
  const [aiMenuY, setAiMenuY] = useState(0);
  const [aiMenuLevel, setAiMenuLevel] = useState(0);

  const handleShowAIContextMenu = (clientX, clientY, lineIdx) => {
    const lines = getLines();
    const line = lines && typeof lineIdx === 'number' ? lines[lineIdx] : null;
    const level = line && typeof line.level === 'number' ? line.level : 0;

    setAiMenuX(clientX);
    setAiMenuY(clientY);
    setAiMenuLevel(level);
    setAiMenuVisible(true);
  };

  return (
    <>
      {aiMenuVisible && (
        <AiContextMenu
          visible={aiMenuVisible}
          x={aiMenuX}
          y={aiMenuY}
          level={aiMenuLevel}
          onClose={() => setAiMenuVisible(false)}
        />
      )}

      <div className="editor-display">
        {visibleLines.map(({ line, index }) => (
          <EditorLine
            key={line.id || index}
            line={line}
            lineIndex={index}
            onShowAIContextMenu={handleShowAIContextMenu}
          />
        ))}
      </div>
    </>
  );

  // AiContextMenu.js – inline style, props-driven
  function AiContextMenu({ visible, x, y, level, onClose }) {
    if (!visible) return null;

    return (
      <div
        className="ai-context-menu-root"
        style={{ left: x, top: y }}
        onClick={onClose}
      >
        ...
      </div>
    );
  }
  ```

    - Closing the menu is a simple `hideAiContextMenu()` intent.
    - View switching just dispatches `hideAiContextMenu()`; reducer owns the details.
  - **Children just dispatch**
    - `EditorLine` dispatches `showAiContextMenu({ x, y, level, source: 'array', lineKey })` on right-click of the fold button.
    - `SimpleMonaco` dispatches similar payloads on glyph right-click.
    - No parent helper function; each file only contains logic that truly belongs to it.
  - **Centralized CSS instead of inline styles**
    - All menu styling lives in `AiContextMenu.css`.
    - Components use class names; inline styles are only for dynamic `left`/`top`.
  - **Fewer bugs, less code to update**
    - Fixing menu alignment or hover behavior now touches one CSS file + one component.
    - No duplicated positioning math between Array and Monaco.
    - App-level code stays short, and editors are easier to read and reason about.
    - Redux state only tracks what is actually used (`visible`, `x`, `y`, `level`), avoiding clutter from unused fields.

  **Impact on code size and complexity**

  - Roughly **40–60 lines** of duplicated menu/render logic were removed from `EditorArray` and `SimpleMonaco`.
  - The new setup centralizes menu UI into one component + one slice, so:
    - There is a **single place** to change behavior or styling.
    - Editors no longer carry menu-specific state/props, making them **easier to scan**.
    - The Redux slice is smaller and only models what the UI actually needs, reducing mental load and chances of bugs.

  **New code (simplified)**

  ```jsx
  // App.js – single global render, no props
  import AiContextMenu from './components/EditorArray/AiContextMenu';

  function App() {
    ...
    return (
      <>
        {viewMode === 'array' ? (
          <EditorArray ref={editorRef} />
        ) : (
          <SimpleMonaco ref={editorRef} />
        )}

        <AiContextMenu />
      </>
    );
  }

  // EditorLine.js – child dispatches intent
  import { useDispatch } from 'react-redux';
  import { showAiContextMenu } from '../../store/aiUiSlice';

  function EditorLine({ line, lineIndex, ... }) {
    const dispatch = useDispatch();

    const handleFoldContextMenu = (e) => {
      if (line.level !== 1 && line.level !== 2) return;
      e.preventDefault();

      dispatch(showAiContextMenu({
        x: e.clientX,
        y: e.clientY,
        level: line.level,
        source: 'array',
        lineKey: line.id || lineIndex,
      }));
    };
  }

  // SimpleMonaco.js – similar dispatch on glyph right-click
  editor.onContextMenu((e) => {
    if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
    const domEvent = e.browserEvent || e.event?.browserEvent || e.event;
    const position = e.target.position;
    const lineNumber = position?.lineNumber;
    const lineContent = model.getLineContent(lineNumber) || '';

    const trimmed = lineContent.trim().toLowerCase();
    let level = 0;
    if (/^#chapter\b/.test(trimmed)) level = 1;
    else if (/^#section\b/.test(trimmed)) level = 2;
    if (!level) return;

    dispatch(showAiContextMenu({
      x: domEvent.clientX,
      y: domEvent.clientY,
      level,
      source: 'monaco',
      lineKey: lineNumber,
    }));
  });

  // aiUiSlice.js – Redux owns the math
  const initialState = {
    visible: false,
    x: 0,
    y: 0,
    level: 0,
    source: null,
    lineKey: null,
  };

  const aiUiSlice = createSlice({
    name: 'aiUi',
    initialState,
    reducers: {
      showAiContextMenu(state, action) {
        const { x, y, level, source, lineKey } = action.payload || {};
        state.visible = true;
        state.x = x;
        state.y = y;
        state.level = level || 0;
        state.source = source || null;
        state.lineKey = lineKey ?? null;
      },
      hideAiContextMenu(state) {
        state.visible = false;
        state.source = null;
        state.lineKey = null;
      },
    },
  });

  export const { showAiContextMenu, hideAiContextMenu } = aiUiSlice.actions;
  ```

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

## 12. Inline Styles in React Components

**Summary**: Avoid large inline style objects in components; use feature-scoped CSS instead.

<details>
<summary>Details & example</summary>

**Wrong**

```javascript
// Component JS mixes behavior with big style objects
function Menu() {
  const style = {
    position: 'fixed',
    backgroundColor: '#111',
    color: '#fff',
    /* ... lots more ... */
  };

  return <div style={style}>...</div>;
}
```

**Right**

```css
/* Menu.css – feature-scoped */
.menu-root {
  position: fixed;
  background-color: #111;
  color: #fff;
}
```

```javascript
import './Menu.css';

function Menu({ x, y }) {
  return (
    <div className="menu-root" style={{ left: x, top: y }}>
      ...
    </div>
  );
}
```

Rules for this codebase:

- Keep **static styling in CSS** files grouped by feature (`EditorArray/AiContextMenu.css`).
- Use inline style **only for dynamic layout** that depends on runtime values (e.g. `left`, `top`).
- This keeps JS readable, makes theming easier, and prevents spaghetti styling.

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

### Reusing Monaco-Specific State for Array View

- We previously reused the Monaco `decorationsNonce` from `aiUiSlice` to force the array editor to refresh AI indicators.
- This couples two unrelated concerns and makes it impossible to reason about which view is driving which refresh.
- Fix: `aiUiSlice` now exposes a dedicated `arrayDecorationsNonce` and `bumpArrayDecorationsNonce`, which `EditorArray` listens to, while Monaco continues to use `decorationsNonce`.

Guideline: **Never reuse a view-specific flag as a global trigger for a different view.** Add a clearly named field for each distinct responsibility.

### Full recomputeVisibleLines() for Single-Line Changes

- In `EditorArray`, changing AI mode for a single header currently calls `recomputeVisibleLines()` and bumps a render trigger.
- `recomputeVisibleLines()` walks the entire `lines` array and rebuilds `visibleLines` (O(n)), which is overkill when only one header’s `sendToAI` changed and its `open` state did not.
- This was acceptable as a first implementation but becomes wasteful at ~10,000+ lines.

Future fix: introduce **localized updates** that only touch the affected header/descendants (or just the metadata used by the eye icon) instead of re-scanning the entire structure for every AI mode toggle.
