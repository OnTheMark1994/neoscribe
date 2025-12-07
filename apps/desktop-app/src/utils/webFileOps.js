// Web file operations - upload and download for browser mode

/**
 * Upload a text file via file input dialog
 */
export const uploadTextFile = () => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md';
    
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) {
        resolve({ success: false });
        return;
      }
      try {
        const content = await file.text();
        resolve({ success: true, content, fileName: file.name });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    };
    
    input.click();
  });
};

/**
 * Download text content as a file
 */
export const downloadTextFile = (content, fileName = 'document.txt') => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Download with filename prompt
 */
export const downloadTextFileAs = (content, defaultName = 'document.txt') => {
  const fileName = prompt('Save as:', defaultName);
  if (fileName) {
    const finalName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
    downloadTextFile(content, finalName);
    return finalName;
  }
  return null;
};
