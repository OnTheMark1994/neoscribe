// Global/FileIO.js

const LAST_FILE_PATH_KEY = 'scribefold:lastFilePath';
const LAST_FILE_NAME_KEY = 'scribefold:lastFileName';
const LAST_FILE_CONTENT_KEY = 'scribefold:lastFileContent';

function isElectron() {
  return Boolean(typeof window !== 'undefined' && window.electronAPI);
}

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

function downloadTextFile({ content, fileName }) {
  const blob = new Blob([content ?? ''], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'Untitled.txt';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function promptForFileName(defaultName) {
  const proposed = window.prompt('File name:', defaultName || 'Untitled.txt');
  if (!proposed) return null;
  return proposed;
}

async function uploadTextFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.markdown,text/plain,text/markdown';
    input.style.display = 'none';

    input.onchange = async () => {
      try {
        const file = input.files && input.files[0];
        if (!file) {
          resolve({ success: false });
          return;
        }

        const text = await file.text();
        resolve({ success: true, fileName: file.name, content: text });
      } catch (e) {
        resolve({ success: false, error: e?.message || String(e) });
      } finally {
        input.remove();
      }
    };

    document.body.appendChild(input);
    input.click();
  });
}

function rememberLastFile({ filePath, fileName, content }) {
  if (filePath) {
    safeLocalStorageSet(LAST_FILE_PATH_KEY, filePath);
  }

  if (fileName) {
    safeLocalStorageSet(LAST_FILE_NAME_KEY, fileName);
  }

  if (typeof content === 'string') {
    safeLocalStorageSet(LAST_FILE_CONTENT_KEY, content);
  }
}

export function getLastFileInfo() {
  return {
    filePath: safeLocalStorageGet(LAST_FILE_PATH_KEY) || '',
    fileName: safeLocalStorageGet(LAST_FILE_NAME_KEY) || '',
    content: safeLocalStorageGet(LAST_FILE_CONTENT_KEY) || '',
  };
}

export async function openFile() {
  if (isElectron()) {
    const api = window.electronAPI;

    if (api?.openFile) {
      const result = await api.openFile();
      if (result?.success) {
        rememberLastFile({ filePath: result.filePath, content: result.content });
      }
      return result;
    }

    if (api?.openEncryptedFile) {
      const result = await api.openEncryptedFile();
      if (result?.success) {
        rememberLastFile({ filePath: result.filePath, content: result.content });
      }
      return result;
    }

    return { success: false, error: 'Electron file API not available' };
  }

  const result = await uploadTextFile();
  if (result?.success) {
    rememberLastFile({ fileName: result.fileName, content: result.content });
  }
  return result;
}

export async function openLastFile() {
  const last = getLastFileInfo();

  if (isElectron()) {
    const filePath = last.filePath;
    if (!filePath) return { success: false };

    const api = window.electronAPI;

    if (api?.openEncryptedFileWithPath) {
      const result = await api.openEncryptedFileWithPath(filePath);
      if (result?.success) {
        rememberLastFile({ filePath: result.filePath, content: result.content });
      }
      return result;
    }

    if (api?.readFile) {
      const result = await api.readFile(filePath);
      if (result?.success) {
        rememberLastFile({ filePath, content: result.content });
        return { success: true, filePath, content: result.content };
      }
      return result;
    }

    return { success: false, error: 'Electron read API not available' };
  }

  if (!last.content) return { success: false };
  return { success: true, fileName: last.fileName || 'Untitled.txt', content: last.content };
}

export async function saveFile({ filePath, fileName, content }) {
  if (isElectron()) {
    const api = window.electronAPI;

    if (filePath && api?.saveFile) {
      const result = await api.saveFile(filePath, content ?? '');
      if (result?.success) {
        rememberLastFile({ filePath, content });
      }
      return result;
    }

    return saveFileAs({ content });
  }

  const resolvedName = fileName || getLastFileInfo().fileName || 'Untitled.txt';
  downloadTextFile({ content: content ?? '', fileName: resolvedName });
  rememberLastFile({ fileName: resolvedName, content: content ?? '' });
  return { success: true, fileName: resolvedName };
}

export async function saveFileAs({ content, suggestedName }) {
  if (isElectron()) {
    const api = window.electronAPI;

    if (!api?.saveFileAs) {
      return { success: false, error: 'Electron saveFileAs API not available' };
    }

    const result = await api.saveFileAs({ content: content ?? '', suggestedName: suggestedName ?? '' });
    if (result?.success && result.filePath) {
      rememberLastFile({ filePath: result.filePath, content });
    }
    return result;
  }

  const proposed = getLastFileInfo().fileName || 'Untitled.txt';
  const name = promptForFileName(proposed);
  if (!name) return { success: false };

  downloadTextFile({ content: content ?? '', fileName: name });
  rememberLastFile({ fileName: name, content: content ?? '' });
  return { success: true, fileName: name };
}
