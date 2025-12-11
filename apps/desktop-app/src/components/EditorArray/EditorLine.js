import React, { useRef, useEffect } from 'react';
import { getLines, getTextFromLines, updateLinesFromText, updateLineText, splitLine, mergeLine } from '../../utils/editorEngine';

/**
 * EditorLine - Individual line component for the array editor
 * 
 * Renders a single editable line with:
 * - Fold button for #chapter/#section headers
 * - AI sharing indicator icons
 * - Diff highlighting for AI proposals
 * - Content editing with Enter/Backspace/Arrow key handling
 */
function EditorLine({ 
  line, 
  lineIndex, 
  displayDepth, 
  isArrayView, 
  onToggleFold, 
  onContentChange,
  onRenderEditor,
  currentChangeId,
  onShowAIContextMenu,
  isAIEnabled
}) {
  const contentRef = useRef(null);

  // Determine CSS classes based on proposed change type
  const isCurrentChange = line.proposedChangeId && currentChangeId === line.proposedChangeId;
  const activeClass = isCurrentChange ? 'diff-line-active' : '';
  
  let editorLineClasses = `editor-line ${isArrayView ? 'array-view-line' : ''}`;
  if (line.proposedChangeType === 'insert') {
    editorLineClasses += ` diff-line-insert ${activeClass}`;
  } else if (line.proposedChangeType === 'delete') {
    editorLineClasses += ` diff-line-delete ${activeClass}`;
  } else if (line.proposedChangeType === 'modify') {
    editorLineClasses += ` diff-line-modify ${activeClass}`;
  }

  const depthClass = isArrayView ? `nesting-depth-${displayDepth}` : '';

  // Auto-scroll to current change when navigating diffs
  useEffect(() => {
    if (!isCurrentChange || !contentRef.current) return;
    const container =
      contentRef.current.closest('.array-line-container, .editor-line') || contentRef.current;
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isCurrentChange, lineIndex, line.proposedChangeId]);

  /**
   * Handle content edits - updates the line text in editorEngine
   */
  const handleContentEdit = (e) => {
    // Capture caret offset within this line before React re-renders
    let caretOffset = null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && contentRef.current) {
      const range = sel.getRangeAt(0);
      if (contentRef.current.contains(range.startContainer)) {
        caretOffset = range.startOffset;
      }
    }

    updateLineText(lineIndex, e.target.textContent);
    onContentChange();

    // Restore caret position after state updates
    if (caretOffset !== null) {
      setTimeout(() => {
        if (!contentRef.current) return;
        const node = contentRef.current;
        const textNode = node.firstChild || node;
        const len = (textNode.textContent || '').length;
        const safeOffset = Math.min(caretOffset, len);

        const range2 = document.createRange();
        const sel2 = window.getSelection();
        try {
          range2.setStart(textNode, safeOffset);
        } catch (err) {
          return;
        }
        range2.collapse(true);
        sel2.removeAllRanges();
        sel2.addRange(range2);
      }, 0);
    }
  };

  /**
   * Restore caret position after mouse click (prevents jump to line start)
   */
  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !contentRef.current) return;

    const range = sel.getRangeAt(0);

    // Don't modify range selections (text highlighting, spellcheck, etc.)
    if (!range.collapsed) return;

    if (!contentRef.current.contains(range.startContainer)) return;

    const offset = range.startOffset;

    setTimeout(() => {
      const node = contentRef.current;
      if (!node) return;
      const textNode = node.firstChild || node;
      const len = (textNode.textContent || '').length;
      const safeOffset = Math.min(offset, len);

      const range2 = document.createRange();
      const sel2 = window.getSelection();
      try {
        range2.setStart(textNode, safeOffset);
      } catch (e) {
        return;
      }
      range2.collapse(true);
      sel2.removeAllRanges();
      sel2.addRange(range2);
    }, 0);
  };

  /**
   * Handle keyboard navigation and editing
   */
  const handleKeyDown = (e) => {
    const lines = getLines();

    // Enter: Split line at cursor
    if (e.key === 'Enter') {
      e.preventDefault();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const offset = range.startOffset;
      splitLine(lineIndex, offset);
      onRenderEditor();
      onContentChange();

      // Focus the new line
      setTimeout(() => {
        const newLineElement = document.querySelector(`[data-idx="${lineIndex + 1}"] .line-content`);
        if (newLineElement) {
          newLineElement.focus();
          const range = document.createRange();
          const sel2 = window.getSelection();
          range.setStart(newLineElement.firstChild || newLineElement, 0);
          range.collapse(true);
          sel2.removeAllRanges();
          sel2.addRange(range);
        }
      }, 0);
    } 
    // Backspace: Merge with previous line if at start
    else if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);

      // If selection covers entire line, clear it
      if (!range.collapsed) {
        const currentText = contentRef.current ? contentRef.current.textContent : lines[lineIndex].text || '';
        const selectedText = range.toString();

        if (selectedText.length === currentText.length && lineIndex >= 0) {
          e.preventDefault();
          updateLineText(lineIndex, '');
          const currentText2 = getTextFromLines();
          updateLinesFromText(currentText2);
          onRenderEditor();
          onContentChange();

          setTimeout(() => {
            const lineElement = document.querySelector(`[data-idx="${lineIndex}"] .line-content`);
            if (lineElement) {
              lineElement.focus();
              const range2 = document.createRange();
              const sel2 = window.getSelection();
              if (lineElement.firstChild) {
                range2.setStart(lineElement.firstChild, 0);
              } else {
                range2.setStart(lineElement, 0);
              }
              range2.collapse(true);
              sel2.removeAllRanges();
              sel2.addRange(range2);
            }
          }, 0);
          return;
        }
        return; // Let browser handle partial selections
      }

      const cursorOffset = range.startOffset;

      // Only merge with previous line when cursor is at the very start
      if (cursorOffset === 0 && lineIndex > 0) {
        e.preventDefault();
        const prevText = lines[lineIndex - 1].text || '';
        const mergePosition = prevText.length;

        mergeLine(lineIndex);
        onRenderEditor();
        onContentChange();

        setTimeout(() => {
          const prevLineElement = document.querySelector(`[data-idx="${lineIndex - 1}"] .line-content`);
          if (prevLineElement) {
            prevLineElement.focus();
            const range2 = document.createRange();
            const sel2 = window.getSelection();
            const pos = Math.min(mergePosition, prevLineElement.textContent.length);
            if (prevLineElement.firstChild) {
              range2.setStart(prevLineElement.firstChild, pos);
            } else {
              range2.setStart(prevLineElement, 0);
            }
            range2.collapse(true);
            sel2.removeAllRanges();
            sel2.addRange(range2);
          }
        }, 0);
      }
    } 
    // Arrow keys: Navigate between lines
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();

      const currentIdx = lineIndex;
      const goingDown = e.key === 'ArrowDown';

      let targetIdx = currentIdx;
      if (goingDown) {
        for (let i = currentIdx + 1; i < lines.length; i++) {
          if (!isLineHidden(i, lines)) {
            targetIdx = i;
            break;
          }
        }
      } else {
        for (let i = currentIdx - 1; i >= 0; i--) {
          if (!isLineHidden(i, lines)) {
            targetIdx = i;
            break;
          }
        }
      }

      if (targetIdx !== currentIdx) {
        setTimeout(() => {
          const targetElement = document.querySelector(`[data-idx="${targetIdx}"] .line-content`);
          if (targetElement) {
            targetElement.focus();
            const range = document.createRange();
            const sel2 = window.getSelection();
            if (goingDown) {
              range.setStart(targetElement.firstChild || targetElement, 0);
            } else {
              const len = targetElement.textContent.length;
              if (targetElement.firstChild) {
                range.setStart(targetElement.firstChild, len);
              } else {
                range.setStart(targetElement, 0);
              }
            }
            range.collapse(true);
            sel2.removeAllRanges();
            sel2.addRange(range);
          }
        }, 0);
      }
    }
  };

  const handleFoldClick = () => {
    onToggleFold(lineIndex);
  };

  const handleFoldContextMenu = (e) => {
    if (!onShowAIContextMenu) return;
    e.preventDefault();
    onShowAIContextMenu(e.clientX, e.clientY, lineIndex);
  };

  /**
   * Get effective AI mode considering parent chapter restrictions
   */
  const getEffectiveSendToAI = () => {
    const ownMode = line.sendToAI || 'all';

    // Only sections can be overridden by a parent chapter
    if (line.level !== 2) {
      return ownMode;
    }

    const lines = getLines();
    let parentChapterMode = null;

    for (let j = lineIndex - 1; j >= 0; j--) {
      const candidate = lines[j];
      if (candidate.level === 1 && candidate.startIdx !== -1 && candidate.endIdx >= lineIndex) {
        parentChapterMode = candidate.sendToAI || 'all';
        break;
      }
    }

    // If parent chapter is limited/hidden, this section is effectively hidden
    if (parentChapterMode && parentChapterMode !== 'all') {
      return 'none';
    }

    return ownMode;
  };

  /**
   * Get appropriate eye icon for AI sharing status
   */
  const getEyeIconSrc = () => {
    const effectiveMode = getEffectiveSendToAI();

    // Show grey eye if parent chapter restricts this section
    if (
      line.level === 2 &&
      effectiveMode === 'none' &&
      (line.sendToAI === 'all' || line.sendToAI === 'title' || line.sendToAI === 'summary')
    ) {
      return '/app-images/scribefold-ai-eye-grey.png';
    }

    if (effectiveMode === 'summary') {
      return '/app-images/scribefold-ai-eye-partial.png';
    }
    if (effectiveMode === 'title') {
      return '/app-images/scribefold-ai-eye-partial-less.png';
    }
    if (effectiveMode === 'all') {
      return '/app-images/scribefold-ai-eye.png';
    }
    return null;
  };

  /**
   * Get display text based on change type
   */
  const getDisplayText = () => {
    if (line.proposedChangeType === 'modify') {
      return line.modifyFrom;
    }
    return line.text;
  };

  const isEditable = line.proposedChangeType !== 'insert';
  const hasFoldButton = line.startIdx !== -1 && line.endIdx !== -1 && line.endIdx >= line.startIdx;
  const aiClass = isAIEnabled ? (line.sendToAI === 'all' ? 'ai-full' : (line.sendToAI === 'title' ? 'ai-partial' : 'ai-none')) : '';

  // Render array view (with index gutter and ID box)
  if (isArrayView) {
    return (
      <div className="array-line-container" data-level={line.level}>
        <div className="array-index-gutter">{lineIndex}:</div>
        <div 
          className={`${editorLineClasses} ${depthClass}`} 
          data-idx={lineIndex} 
          data-level={line.level}
          data-change-id={line.proposedChangeId || ''}
        >
          <div className="array-id-box">{line.id}:</div>
          
          {hasFoldButton ? (
            <button 
              className={`fold-btn ${aiClass}`}
              data-idx={lineIndex}
              onClick={handleFoldClick}
              onContextMenu={handleFoldContextMenu}
            >
              {line.open ? '−' : '+'}
              {isAIEnabled && getEyeIconSrc() && (
                <img
                  src={getEyeIconSrc()}
                  alt="AI sharing"
                  className="fold-btn-eye"
                  draggable="false"
                />
              )}
            </button>
          ) : (
            <span className="fold-spacer"></span>
          )}
          
          {line.proposedChangeType === 'modify' ? (
            <div className="modify-stack">
              <div
                ref={contentRef}
                className="line-content diff-line-delete"
                contentEditable={true}
                suppressContentEditableWarning={true}
                onInput={handleContentEdit}
                onKeyDown={handleKeyDown}
                onMouseUp={handleMouseUp}
                data-idx={lineIndex}
              >
                {line.modifyFrom}
              </div>
              <div
                className="line-content diff-line-insert"
                contentEditable={false}
                suppressContentEditableWarning={true}
                data-idx={lineIndex}
              >
                {line.modifyTo || line.text || ''}
              </div>
            </div>
          ) : (
            <div 
              ref={contentRef}
              className="line-content" 
              contentEditable={isEditable}
              suppressContentEditableWarning={true}
              onInput={handleContentEdit}
              onKeyDown={handleKeyDown}
              onMouseUp={handleMouseUp}
              data-idx={lineIndex}
            >
              {getDisplayText()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render fold view (without index gutter)
  return (
    <div 
      className={`${editorLineClasses} ${depthClass}`} 
      data-idx={lineIndex} 
      data-level={line.level}
      data-change-id={line.proposedChangeId || ''}
    >
      {hasFoldButton ? (
        <button 
          className={`fold-btn ${aiClass}`}
          data-idx={lineIndex}
          onClick={handleFoldClick}
          onContextMenu={handleFoldContextMenu}
        >
          {line.open ? '−' : '+'}
          {isAIEnabled && getEyeIconSrc() && (
            <img
              src={getEyeIconSrc()}
              alt="AI sharing"
              className="fold-btn-eye"
              draggable="false"
            />
          )}
        </button>
      ) : (
        <span className="fold-spacer"></span>
      )}
      
      {line.proposedChangeType === 'modify' ? (
        <div className="modify-stack">
          <div 
            ref={contentRef}
            className="line-content diff-line-delete" 
            contentEditable={true}
            suppressContentEditableWarning={true}
            onInput={handleContentEdit}
            onKeyDown={handleKeyDown}
            onMouseUp={handleMouseUp}
            data-idx={lineIndex}
          >
            {line.modifyFrom}
          </div>
          <div 
            className="line-content diff-line-insert" 
            contentEditable={false}
            suppressContentEditableWarning={true}
            data-idx={lineIndex}
          >
            {line.modifyTo || line.text || ''}
          </div>
        </div>
      ) : (
        <div 
          ref={contentRef}
          className="line-content" 
          contentEditable={isEditable}
          suppressContentEditableWarning={true}
          onInput={handleContentEdit}
          onKeyDown={handleKeyDown}
          onMouseUp={handleMouseUp}
          data-idx={lineIndex}
        >
          {getDisplayText()}
        </div>
      )}
    </div>
  );
}

/**
 * Check if a line is hidden (inside a collapsed fold)
 */
const isLineHidden = (lineIdx, lines) => {
  for (let j = lineIdx - 1; j >= 0; j--) {
    const p = lines[j];
    if (p.startIdx !== -1 && p.endIdx >= lineIdx && !p.open) {
      return true;
    }
  }
  return false;
};

export default EditorLine;
