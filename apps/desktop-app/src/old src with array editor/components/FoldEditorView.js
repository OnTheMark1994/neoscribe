import React from 'react';
import EditorLine from './EditorLine';
import DiffActionButtons from './DiffActionButtons';

/**
 * FoldEditorView - Child component for fold/array editor view
 * 
 * This component is ONLY responsible for rendering the folding editor with EditorLine components.
 * All keyboard shortcuts, save logic, find logic, fold logic, etc. are handled by the parent Editor component.
 */
function FoldEditorView({
  editorRef,
  visibleLines,
  isArrayView,
  onToggleFold,
  onContentChange,
  onRenderEditor,
  currentChangeId,
  onShowAIContextMenu,
  isAIEnabled
}) {
  return (
    <div id="editor-display" className="editor-display" ref={editorRef}>
      {visibleLines.map(({ line, index, displayDepth }) => (
        <React.Fragment key={line.id || index}>
          <EditorLine
            line={line}
            lineIndex={index}
            displayDepth={displayDepth}
            isArrayView={isArrayView}
            onToggleFold={onToggleFold}
            onContentChange={onContentChange}
            onRenderEditor={onRenderEditor}
            currentChangeId={currentChangeId}
            onShowAIContextMenu={onShowAIContextMenu}
            isAIEnabled={isAIEnabled}
          />
          {line.proposedChangeType && (
            <DiffActionButtons
              proposedChangeId={line.proposedChangeId}
              changeType={line.proposedChangeType}
              onUpdate={onRenderEditor}
              onContentChange={onContentChange}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default FoldEditorView;
