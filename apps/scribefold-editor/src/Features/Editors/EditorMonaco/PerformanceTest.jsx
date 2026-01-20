import React, { useState } from 'react';

const PerformanceTest = ({ editorRef, onClose }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState([]);
  const [log, setLog] = useState([]);
  const [customLineCount, setCustomLineCount] = useState('10000');

  const addLog = (message) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const generateTestDocument = (lineCount) => {
    const lines = [];
    const chapters = Math.max(1, Math.floor(lineCount / 200));
    
    for (let c = 1; c <= chapters; c++) {
      lines.push(`#chapter Test Chapter ${c}`);
      lines.push(`Content for chapter ${c}.`);
      
      const sections = Math.max(1, Math.floor(lineCount / chapters / 50));
      for (let s = 1; s <= sections; s++) {
        lines.push(`#section Section ${c}.${s}`);
        lines.push(`Content for section ${s}.`);
        
        const paragraphs = Math.max(1, Math.floor(lineCount / chapters / sections / 10));
        for (let p = 1; p <= paragraphs; p++) {
          lines.push(`Paragraph ${p} content.`);
        }
      }
    }
    
    return lines.slice(0, lineCount).join('\n');
  };

  const runPerformanceTest = async () => {
    if (!editorRef?.current) {
      addLog('Error: No editor reference');
      return;
    }

    setIsTesting(true);
    setResults([]);
    setLog([]);
    
    const editor = editorRef.current;
    const monaco = window.monaco;

    try {
      const testSizes = customLineCount 
        ? [parseInt(customLineCount, 10)]
        : [100, 1000, 5000, 10000];
      
      for (const lineCount of testSizes) {
        addLog(`Generating ${lineCount} lines...`);
        
        // Generate content
        const testContent = generateTestDocument(lineCount);
        
        // Test setValue
        const setValueStart = performance.now();
        editor.setValue(testContent);
        const setValueTime = performance.now() - setValueStart;
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Test folding
        const model = editor.getModel();
        const foldingStart = performance.now();
        editor.updateOptions({ folding: true });
        editor.layout();
        const foldingTime = performance.now() - foldingStart;
        
        // Test typing
        const typingStart = performance.now();
        for (let i = 0; i < 3; i++) {
          const randomLine = Math.floor(Math.random() * model.getLineCount()) + 1;
          editor.executeEdits('test', [{
            range: new monaco.Range(randomLine, 1, randomLine, 1),
            text: 'TEST'
          }]);
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        const typingTime = performance.now() - typingStart;
        
        // Collect results
        setResults(prev => [...prev, {
          lines: lineCount,
          setValueMs: setValueTime.toFixed(2),
          foldingMs: foldingTime.toFixed(2),
          typingMs: typingTime.toFixed(2),
          timestamp: new Date().toLocaleTimeString()
        }]);
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      addLog('Tests completed');
    } catch (error) {
      addLog(`Error: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="performance-test">
      <div className="performance-test-header">
        <h3>Performance Test</h3>
        <button className="performance-test-close" onClick={onClose}>×</button>
      </div>
      
      <div className="performance-test-controls">
        <label>
          Lines: 
          <input
            type="number"
            value={customLineCount}
            onChange={(e) => setCustomLineCount(e.target.value)}
            className="performance-test-input"
          />
        </label>
        <button
          onClick={runPerformanceTest}
          disabled={isTesting}
          className="performance-test-button"
        >
          {isTesting ? 'Testing...' : 'Run Test'}
        </button>
      </div>
      
      {results.length > 0 && (
        <div className="performance-test-results">
          <table>
            <thead>
              <tr>
                <th>Lines</th>
                <th>Set Value</th>
                <th>Folding</th>
                <th>Typing</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => (
                <tr key={idx}>
                  <td>{result.lines}</td>
                  <td>{result.setValueMs}ms</td>
                  <td>{result.foldingMs}ms</td>
                  <td>{result.typingMs}ms</td>
                  <td>{result.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="performance-test-log">
        <h4>Log</h4>
        <div className="performance-test-log-content">
          {log.map((entry, idx) => (
            <div key={idx} className="performance-test-log-entry">{entry}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PerformanceTest;
