/**
 * AiChangeManager - Monaco Diff Editor Implementation
 * 
 * Uses Monaco's built-in diff editor to show current vs proposed versions
 * 
 * Flow:
 * 1. Get current editor content (original)
 * 2. Build modified version by applying all AI proposals
 * 3. Create Monaco diff editor with both versions
 * 4. Show in view zones with Accept/Reject buttons
 */
export class AiChangeManager {
  constructor(editor, dispatch) {
    this.editor = editor;
    this.dispatch = dispatch;
    this.zoneIds = new Map(); // change.id → zoneId
    this.diffEditors = new Map(); // change.id → { diffEditor, models }
    this.changes = [];
    this.lineIdToNumber = new Map();
    this.activeChangeId = null;
  }

  /**
   * Update view zones with Monaco diff editors
   */
  updateChanges(changes, lineIdToNumber) {
    console.log('🔵 [AiChangeManager] updateChanges called');
    console.log('📦 Changes received:', changes);
    console.log('🗺️ Line ID to Number map:', lineIdToNumber);
    
    // 1. CLEAR EVERYTHING FIRST
    this.clearAll();
    
    this.changes = changes;
    this.lineIdToNumber = lineIdToNumber;

    if (changes.length === 0) {
      console.log('⚠️ No changes to display');
      return;
    }

    const monaco = window.monaco;
    if (!monaco) {
      console.error('❌ Monaco not available');
      return;
    }
    
    const model = this.editor.getModel();
    if (!model) {
      console.error('❌ Editor model not available');
      return;
    }
    
    console.log('✅ Monaco and model ready');

    // 2. Create view zones with diff editors for each change
    this.editor.changeViewZones((accessor) => {
      changes.forEach((change, index) => {
        console.log(`\n🔍 [Change ${index + 1}/${changes.length}] Processing:`, change);
        
        const lineNumber = lineIdToNumber.get(change.lineID);
        if (lineNumber === undefined) {
          console.warn(`⚠️ Line number not found for lineID: ${change.lineID}`);
          return;
        }
        
        console.log(`📍 Line number for change: ${lineNumber}`);

        // Get current line content
        const currentLineContent = model.getLineContent(lineNumber);
        console.log(`📄 Current line content: "${currentLineContent}"`);
        
        // Build ORIGINAL version (current state)
        let originalContent = '';
        if (change.type === 'modify' || change.type === 'delete') {
          originalContent = change.originalText || currentLineContent;
        } else if (change.type === 'insert') {
          // For insert, original is empty (we're adding new lines)
          originalContent = '';
        }
        console.log(`📝 Original content:\n${originalContent}`);
        
        // Build MODIFIED version (proposed state)
        let modifiedContent = '';
        if (change.type === 'modify') {
          modifiedContent = change.proposedText || '';
        } else if (change.type === 'insert') {
          modifiedContent = Array.isArray(change.linesToInsert) 
            ? change.linesToInsert.join('\n') 
            : '';
        } else if (change.type === 'delete') {
          // For delete, modified is empty (we're removing the line)
          modifiedContent = '';
        }
        console.log(`✨ Modified content:\n${modifiedContent}`);
        
        // Create container for diff editor + buttons
        const container = this.createDiffEditorContainer(
          monaco,
          change,
          originalContent,
          modifiedContent,
          index,
          changes.length,
          lineNumber
        );

        if (!container) {
          console.error(`❌ Failed to create container for change ${index + 1}`);
          return;
        }
        
        // Insert zone AFTER the target line
        const afterLineNumber = change.type === 'insert' ? lineNumber : lineNumber;
        console.log(`📌 Inserting view zone after line ${afterLineNumber}`);
        
        // Use fixed pixel height for diff editor
        const zone = {
          afterLineNumber: afterLineNumber,
          heightInPx: 250, // Fixed height for diff editor + buttons
          domNode: container,
          suppressMouseDown: false,
        };

        const zoneId = accessor.addZone(zone);
        this.zoneIds.set(change.id, zoneId);
        console.log(`✅ View zone created with ID: ${zoneId}`);
      });
    });

    // Auto-scroll to first change
    if (changes.length > 0) {
      const firstLine = lineIdToNumber.get(changes[0].lineID);
      if (firstLine) {
        console.log(`📜 Scrolling to first change at line ${firstLine}`);
        this.editor.revealLineInCenter(firstLine);
      }
    }
    
    console.log('✅ [AiChangeManager] All changes rendered\n');
  }

  /**
   * Create container with Monaco diff editor showing original vs modified
   */
  createDiffEditorContainer(monaco, change, originalContent, modifiedContent, index, total, lineNumber) {
    console.log(`🏗️ [createDiffEditorContainer] Building for change ${index + 1}`);
    
    // Main container - FIXED: Less margin, proper positioning
    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      padding: 8px;
      background: #1e1e1e;
      border-left: 4px solid #ff9800;
      margin: 8px 0;
      border-radius: 4px;
      font-family: system-ui;
      pointer-events: auto;
      width: 100%;
      box-sizing: border-box;
    `;
    
    // Header with info
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px; color: #ccc; font-size: 11px;';
    header.textContent = `${index + 1} of ${total} • ${change.type}`;
    container.appendChild(header);
    
    // Diff editor container - FIXED: Proper sizing
    const diffContainer = document.createElement('div');
    diffContainer.style.cssText = `
      width: 100%;
      height: 150px;
      border: 1px solid #444;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
      background: #1e1e1e;
    `;
    container.appendChild(diffContainer);
    
    console.log(`📦 Creating Monaco models:`);
    console.log(`   Original model content: "${originalContent}"`);
    console.log(`   Modified model content: "${modifiedContent}"`);
    
    // Create models for diff editor
    const originalModel = monaco.editor.createModel(originalContent, 'markdown');
    const modifiedModel = monaco.editor.createModel(modifiedContent, 'markdown');
    
    console.log(`✅ Models created successfully`);
    console.log(`🔧 Creating diff editor with options:`, {
      renderSideBySide: false,
      readOnly: true,
    });
    
    // Create diff editor - WILL LAYOUT AFTER ADDING TO DOM
    const diffEditor = monaco.editor.createDiffEditor(diffContainer, {
      renderSideBySide: false, // Inline diff view
      readOnly: true,
      enableSplitViewResizing: false,
      renderOverviewRuler: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderMarginRevertIcon: false,
      lineNumbers: 'off',
      glyphMargin: false,
      folding: false,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
    });
    
    console.log(`🎨 Setting models on diff editor`);
    // Set the models
    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });
    
    // IMPORTANT: Layout will happen after container is added to DOM
    // We'll do it in a setTimeout to ensure DOM is ready
    setTimeout(() => {
      const width = diffContainer.clientWidth;
      const height = diffContainer.clientHeight;
      console.log(`📏 Laying out diff editor: ${width}x${height}`);
      diffEditor.layout({ width, height });
    }, 10);
    
    console.log(`✅ Diff editor created (will layout after DOM insertion)`);
    
    // Store diff editor for cleanup
    this.diffEditors.set(change.id, { diffEditor, originalModel, modifiedModel });
    
    // Buttons container - FIXED: Proper pointer events
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end; pointer-events: auto; position: relative; z-index: 10;';
    
    // Accept button
    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = '✓ Accept';
    acceptBtn.style.cssText = 'background: #4caf50; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; pointer-events: auto;';
    acceptBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log(`✅ Accept clicked for change: ${change.id}`);
      this.acceptChange(change, lineNumber);
    };
    
    // Reject button
    const rejectBtn = document.createElement('button');
    rejectBtn.textContent = '✗ Reject';
    rejectBtn.style.cssText = 'background: #f44336; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; pointer-events: auto;';
    rejectBtn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log(`❌ Reject clicked for change: ${change.id}`);
      this.rejectChange(change.id, change.lineID);
    };
    
    buttonRow.appendChild(acceptBtn);
    buttonRow.appendChild(rejectBtn);
    container.appendChild(buttonRow);
    
    console.log(`✅ Container created successfully`);
    return container;
  }

  /**
   * Navigate to a specific change
   */
  navigateToChange(currentIndex, direction) {
    const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= this.changes.length) return;

    const targetChange = this.changes[targetIndex];
    if (!targetChange) return;

    const lineNumber = this.lineIdToNumber.get(targetChange.lineID);
    if (lineNumber !== undefined) {
      this.editor.revealLineInCenter(lineNumber);
      this.activeChangeId = targetChange.id;
      
      if (this.dispatch) {
        const { setActiveChangeId } = require('../store/aiSlice');
        this.dispatch(setActiveChangeId(targetChange.id));
      }
    }
  }

  /**
   * Navigate to change by ID
   */
  goToChange(changeId, lineIdToNumber) {
    this.activeChangeId = changeId;
    const change = this.changes.find(c => c.id === changeId);
    if (!change) return;

    const lineNumber = lineIdToNumber.get(change.lineID);
    if (lineNumber !== undefined) {
      this.editor.revealLineInCenter(lineNumber);
    }
  }

  /**
   * ACCEPT: Apply edit to model, then clear proposal
   */
  acceptChange(change, lineNumber) {
    const model = this.editor.getModel();
    if (!model) return;

    const monaco = window.monaco;
    if (!monaco) return;

    // NOW we apply the edit to the model
    if (change.type === 'modify' && change.proposedText) {
      model.pushEditOperations([], [{
        range: new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber)),
        text: change.proposedText,
        forceMoveMarkers: true,
      }], () => null);
    } 
    else if (change.type === 'insert' && change.linesToInsert) {
      model.pushEditOperations([], [{
        range: new monaco.Range(lineNumber + 1, 1, lineNumber + 1, 1),
        text: change.linesToInsert.join('\n') + '\n',
        forceMoveMarkers: true,
      }], () => null);
    }
    else if (change.type === 'delete') {
      model.pushEditOperations([], [{
        range: new monaco.Range(lineNumber, 1, lineNumber + 1, 1),
        text: '',
        forceMoveMarkers: true,
      }], () => null);
    }

    // Remove this zone and clear from Redux
    this.removeChange(change.id);
    
    if (this.dispatch) {
      const { clearProposalForId } = require('../store/aiSlice');
      this.dispatch(clearProposalForId(change.lineID));
    }
  }

  /**
   * REJECT: Just remove overlay, don't touch model
   */
  rejectChange(changeId, lineID) {
    this.removeChange(changeId);
    
    if (this.dispatch) {
      const { clearProposalForId } = require('../store/aiSlice');
      this.dispatch(clearProposalForId(lineID));
    }
  }

  /**
   * Remove a single change's zone and dispose its diff editor
   */
  removeChange(changeId) {
    console.log(`🗑️ [removeChange] Removing change: ${changeId}`);
    
    // Remove view zone
    this.editor.changeViewZones((accessor) => {
      const zoneId = this.zoneIds.get(changeId);
      if (zoneId) {
        accessor.removeZone(zoneId);
        this.zoneIds.delete(changeId);
        console.log(`  ✅ View zone removed`);
      }
    });
    
    // Dispose diff editor and models
    const diffEditorData = this.diffEditors.get(changeId);
    if (diffEditorData) {
      const { diffEditor, originalModel, modifiedModel } = diffEditorData;
      console.log(`  🧹 Disposing diff editor and models`);
      diffEditor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
      this.diffEditors.delete(changeId);
      console.log(`  ✅ Diff editor disposed`);
    }
    
    // Remove from local changes array
    this.changes = this.changes.filter(c => c.id !== changeId);
    console.log(`  ✅ Change removed from local array`);
  }

  /**
   * Accept all changes
   */
  acceptAll(changes, lineIdToNumber) {
    // Apply all changes to model
    changes.forEach((change) => {
      const lineNumber = lineIdToNumber.get(change.lineID);
      if (lineNumber !== undefined) {
        this.acceptChange(change, lineNumber);
      }
    });

    if (this.dispatch) {
      const { acceptAllProposals } = require('../store/aiSlice');
      this.dispatch(acceptAllProposals());
    }
  }

  /**
   * Reject all changes
   */
  rejectAll() {
    this.clearAll();

    if (this.dispatch) {
      const { rejectAllProposals } = require('../store/aiSlice');
      this.dispatch(rejectAllProposals());
    }
  }

  /**
   * Clear all zones and dispose all diff editors
   */
  clearAll() {
    console.log(`🧹 [clearAll] Clearing all changes`);
    
    // Remove all view zones
    this.editor.changeViewZones((accessor) => {
      for (const zoneId of this.zoneIds.values()) {
        accessor.removeZone(zoneId);
      }
    });
    this.zoneIds.clear();
    console.log(`  ✅ All view zones cleared`);
    
    // Dispose all diff editors and models
    this.diffEditors.forEach(({ diffEditor, originalModel, modifiedModel }, changeId) => {
      console.log(`  🗑️ Disposing diff editor for change: ${changeId}`);
      diffEditor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
    });
    this.diffEditors.clear();
    console.log(`  ✅ All diff editors disposed`);
    
    this.changes = [];
  }

  /**
   * Dispose
   */
  dispose() {
    this.clearAll();
  }
}
