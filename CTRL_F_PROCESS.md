# Ctrl+F Find Process - Order of Operations

## Textarea View (Simple & Fast)

### When User Presses Ctrl+F:
1. **Show find box** - `setIsFindVisible(true)`
2. **Focus find input** - `findInputRef.current.focus()`

### When User Types in Find Box:
1. **Update query state** - `setFindQuery(value)`
2. **Immediately search** - `recomputeFindMatches(value)` (no debounce, it's fast)
   - Clear previous matches
   - Get textarea value
   - Use `String.indexOf()` to find all occurrences
   - Store matches as `[{startIndex, endIndex}, ...]`
   - Set `currentFindIndex` to 0 (first match)
3. **Auto-highlight triggered** - `useEffect` detects `currentFindIndex` changed
   - Call `highlightCurrentFindMatch(0)`
   - Use `textareaRef.current.setSelectionRange()` to select text
   - Calculate scroll position and center the match
   - Use `requestAnimationFrame` to ensure DOM is ready

### When User Clicks ↑/↓:
1. **Update index** - `setCurrentFindIndex(prev => next)`
2. **Auto-highlight triggered** - `useEffect` detects `currentFindIndex` changed
   - Call `highlightCurrentFindMatch(newIndex)`
   - Select and scroll to new match

**Performance:** Very fast - just string searching + native selection API

---

## Array/Fold View (Complex & Slower)

### When User Presses Ctrl+F:
1. **Show find box** - `setIsFindVisible(true)`
2. **Focus find input** - `findInputRef.current.focus()`

### When User Types in Find Box:
1. **Update query state** - `setFindQuery(value)`
2. **Debounced search** - Wait 150ms after user stops typing
   - Prevents lag while typing
   - Then call `recomputeFindMatches(value)`
3. **Search process** - `recomputeFindMatches(value)`:
   - Clear previous highlights (unwrap all `<span>` elements)
   - Query all `.line-content` elements in DOM
   - For each line:
     - Search line content text
     - Search line number (if array view)
     - Search line ID (if array view)
   - Store matches as `[{element, lineIndex, startIndex, endIndex, type}, ...]`
   - **Wrap matches in `<span>` elements** (DOM manipulation - slow part)
   - Set `currentFindIndex` to 0
4. **Auto-highlight triggered** - `useEffect` detects `currentFindIndex` changed
   - Call `highlightCurrentFindMatch(0)`
   - Add `.find-highlight-current` class to first match
   - Scroll element into view

### When User Clicks ↑/↓:
1. **Update index** - `setCurrentFindIndex(prev => next)`
2. **Auto-highlight triggered** - `useEffect` detects `currentFindIndex` changed
   - Remove `.find-highlight-current` from previous
   - Add `.find-highlight-current` to new match
   - Scroll into view

**Performance:** Slower due to:
- DOM queries (`.querySelectorAll`)
- Text node splitting and wrapping in `<span>` elements
- Multiple searches per line (content, line number, ID)

**Optimization:** 150ms debounce prevents searching on every keystroke

---

## Key Differences

| Aspect | Textarea View | Array/Fold View |
|--------|---------------|-----------------|
| Search method | `String.indexOf()` | DOM traversal + text search |
| Highlight method | `setSelectionRange()` | Wrap in `<span>` elements |
| Performance | Very fast | Slower (DOM manipulation) |
| Debouncing | None (instant) | 150ms |
| Scroll method | Calculate line position | `scrollIntoView()` |
| Search scope | Just text content | Content + line numbers + IDs |

---

## Common Flow (Both Views)

1. **Ctrl+F pressed** → Show find box, focus input
2. **User types** → Update query, trigger search (debounced in array view)
3. **Search completes** → Store matches, set index to 0
4. **useEffect triggers** → Auto-highlight first match
5. **User navigates** → Update index
6. **useEffect triggers** → Auto-highlight new match
7. **Escape pressed** → Hide find box, clear highlights
