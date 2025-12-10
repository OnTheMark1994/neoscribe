import { createContext } from 'react';

/**
 * EditorContext - Provides Editor's imperative API to child components
 * 
 * WHAT: Context containing ref to Editor component's imperative methods (saveFile, foldAll, etc)
 * 
 * WHY: Avoids prop drilling editorRef through multiple component layers
 * 
 * WHO USES:
 *   - AISidebar: Calls updateLinesFromAI() to inject AI changes
 *   - DiffNavigation/DiffActionButtons: Calls acceptChange/rejectChange methods
 *   - WebMenuBar: Calls saveFile, openFile, foldAll, etc for menu actions
 * 
 * PROVIDES: editorRef (React ref containing Editor's imperative API)
 * 
 * ALTERNATIVE CONSIDERED: Passing editorRef as prop to each component
 * WHY CONTEXT IS BETTER: Components deep in tree (DiffActionButtons) would need ref passed through multiple levels
 * 
 * USAGE:
 *   // In App.js (provider)
 *   <EditorContext.Provider value={editorRef}>
 *     <AISidebar />
 *   </EditorContext.Provider>
 * 
 *   // In child component (consumer)
 *   const editorRef = useContext(EditorContext);
 *   editorRef.current?.saveFile();
 */
export const EditorContext = createContext(null);
