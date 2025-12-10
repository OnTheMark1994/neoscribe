STRICT RULES — FOLLOW EXACTLY

1. NO COOKED SPAGHETTI  
When spaghetti is dry the lines are clear like how the lines of logic on a circuit board are clear. When its cooked the lines of spahetti are tangled up and the path hard to follow. We want the lines of logic to be simple and direct like dry spaghetti not a tangled tightly coupled mess like cooked spaghetti. This makes it so bugs are less likely, easier to identify and resolve, and new features are easy to add and the project is scaleable. 
This means everything must be ORGANIZED intentionally, kept scaleable, and very human readable. 

2. NO BOOMERANG STATE / PROP DRILLING  
   State lives at the lowest component that needs it OR in Redux if ≥2 components need it.  
   Never lift state just to pass it back down.  
   Never pass (dispatch) => dispatch(action) wrapper functions. The point of redux it to avoid prop drilling. 

3. MEANINGFUL COMMENTS ALWAYS
   - You must add a comment above each variable and function explaining what it does and why it is where it is. You must criticallly check each piece each time to ensure we are folling good coding princimples and reccomend changes if so. For example when adding a topnav with settings buttons we may need to move settings state into redux instead of local state. YOU MUST JUSTIFY WHY EACH VARIABLE AND FUNCTION IS IN THE COMPONENT IT IS IN, AND EXPLAIN WHY THERE IS NO BETTER PLACE TO PUT IT. If a function is in App.js and passed into a child YOU MUST JUSTIFY WHY THIS IS NECESSARY.

4. FILE ORGANIZATION - FEATURE-BASED STRUCTURE
   Components, styles, and utilities must be organized by FEATURE, not by type.
   
   **WRONG** (By Type):
   ```
   components/
     Button.js
     Modal.js
     Editor.js
     AISidebar.js
     Settings.js
   ```
   
   **RIGHT** (By Feature):
   ```
   components/
     Editor/
       Editor.js
       EditorLine.js
       MonacoEditorView.js
       FoldEditorView.js
       TextareaEditorView.js
       Editor.css
       MonacoEditorView.css
     AI/
       AISidebar.js
       AISidebar.css
       DiffNavigation.js
       DiffActionButtons.js
     Settings/
       Settings.js
       AccountAuthSection.js
       TokenInfoModal.js
     Layout/
       WebMenuBar.js
       StatusBar.js
       Menus.js
     Common/
       Window.js
       LoadingScreen.js
   ```
   
   **WHY FEATURE-BASED:**
   - All related code in one place (easier to find, modify, test)
   - Clear feature boundaries (prevents tight coupling)
   - Easy to add/remove entire features
   - Scalable to large codebases
   - Industry standard (used by React, Vue, Angular teams)
   
   **NAMING RULES:**
   - Feature folders: PascalCase (Editor/, AI/, Settings/)
   - Component files: PascalCase matching component name (Editor.js, AISidebar.js)
   - CSS files: Match component name exactly (Editor.css, AISidebar.css)
   - Index files: Use index.js to export from feature folders
   - Utils: Group by feature in feature folder, or shared/ for cross-feature
   
   **WHEN TO CREATE NEW FOLDER:**
   - ≥3 files belong to same feature → create feature folder
   - Single file used by multiple features → keep in parent or Common/
   - Feature has sub-features → nested folders OK (Settings/Auth/, Settings/Tokens/)
   
   **IMPORT PATTERNS:**
   ```javascript
   // GOOD: Explicit imports
   import Editor from './components/Editor/Editor';
   import { AISidebar } from './components/AI';
   
   // BETTER: With index.js
   import { Editor } from './components/Editor';
   import { AISidebar, DiffNavigation } from './components/AI';
   ```

5. PERFORMANCE & BIG O NOTATION
   Every function processing user input or large data MUST have Big O comment.
   
   **REQUIRED COMMENT FORMAT:**
   ```javascript
   // WHAT: Parses document into lines array with fold metadata
   // BIG O: O(n) where n = number of lines
   // WHY EFFICIENT: Single pass, no nested loops, early termination
   // PERFORMANCE: ~1ms for 10k lines, acceptable for documents up to 100k lines
   // CALLED: On file open, content change (debounced 300ms)
   // OPTIMIZATION: Uses string methods (indexOf, slice) instead of regex where possible
   function parseText(text) { /* ... */ }
   ```
   
   **CRITICAL RULES:**
   - NO O(n²) or worse in event handlers (keypress, scroll, resize)
   - Debounce expensive operations (300ms for typing, 16ms for scroll)
   - Use refs for values needed in callbacks (avoid stale closures)
   - Memoize expensive computations with useMemo
   - Virtualize long lists (render only visible items)
   
   **COMMON VIOLATIONS:**
   ```javascript
   // BAD: O(n) on every keystroke
   onChange={(e) => {
     const lines = text.split('\n'); // Runs on every character typed
     setLineCount(lines.length);
   }}
   
   // GOOD: Debounced O(n)
   const debouncedCount = useDebounce(() => {
     const lines = text.split('\n');
     setLineCount(lines.length);
   }, 300);
   onChange={(e) => { debouncedCount(); }}
   
   // BAD: O(n²) - nested loops
   lines.forEach(line => {
     lines.forEach(otherLine => { /* compare */ }); // O(n²)
   });
   
   // GOOD: O(n) - hash map
   const lineMap = new Map();
   lines.forEach(line => lineMap.set(line.id, line)); // O(n)
   ```

6. EFFICIENCY FIRST  
   - do not do aything stupid like running an expensive calculatoin after every keystroke. Consider the speed of the application and big O notation for each process. 

7. PLAN BEFORE CODE  
   You MUST output this exact structure first:
   1. Components tree + which state each owns
   2. Redux slices + what data each holds
   3. Data flow for every feature (user click → action → reducer → selector → UI)
   4. Then write code with required comments

8. Create a plan md file. You will find or create the Plan folder with an overview and features folder. The overfiew has plaintext descriptiosn of what the application does. The overview is the single source of truth for the overall archatecture. The features folder has the description of each features and the data flows for each use case. For example "Open then save" => user opens file, then edits it, then presses ctrl s => the exact flow of each piece of data and function where it is stored in each variable and where each is stored and called from. EACH FEATURE NEEDS A FILE. EACH USE CASE NEEDS A SECTION IN THE FEATURE FILE. THere will be many. This is necessary to ensure we are desiging our flows efficiently and correctly. 

Itterate:
After choosing a design principle and planning it critically assess if its all now the best possible way to do it. If not change the plan, affter changing it reassess it.  
Keep iterating until everything is optimal.
When you code it up do the same things, write the code, add detailed comments so someone who is not familiar with the codebase can understand immediately what it does and why its in the best place. After doing this assess it critically and recheck to see if that is actually the best lace considering all of the other places it coudl be and setups that could work. 
Keep itterating until you are sure out of all possible optoins this is the best one. 
If we keep it clean while we are adding we save the costly technical cleanup process.  

Zero tolerance. Violate any rule → rewrite entire file.