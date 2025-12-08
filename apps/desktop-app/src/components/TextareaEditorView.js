
import React from 'react';
import "./TextareaEditorView.css"

/**
 * TextareaEditorView - Child component for plain textarea editor view
 * 
 * This component is ONLY responsible for rendering the textarea.
 * All keyboard shortcuts, save logic, find logic, etc. are handled by the parent Editor component.
 */
function TextareaEditorView({ textareaRef, content, onContentChange, placeholder }) {
  return (
    <textarea
      ref={textareaRef}
      id="editor"
      className="editor-textarea"
      value={content}
      onChange={(e) => {
        onContentChange(e.target.value);
      }}
      placeholder={placeholder || "Start typing or use File menu to open a file..."}
      spellCheck={true}
    />
  );
}

export default TextareaEditorView;
