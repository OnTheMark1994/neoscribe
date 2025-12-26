// Global/FileIO.js

import { decryptText, encryptText, isEncryptedText } from './CryptoIO';

const LAST_FILE_PATH_KEY = 'scribefold:lastFilePath';
const LAST_FILE_NAME_KEY = 'scribefold:lastFileName';
const LAST_FILE_CONTENT_KEY = 'scribefold:lastFileContent';

const sessionEncryptionPasswords = new Map();

function getSessionPassword(filePath) {
  if (!filePath) return '';
  return String(sessionEncryptionPasswords.get(String(filePath)) || '');
}

function setSessionPassword(filePath, password) {
  if (!filePath) return;
  if (!password) {
    sessionEncryptionPasswords.delete(String(filePath));
    return;
  }
  sessionEncryptionPasswords.set(String(filePath), String(password));
}

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

async function platformSaveTextFile({ filePath, fileName, content, suggestedName }) {
  if (isElectron()) {
    const api = window.electronAPI;

    if (filePath && api?.saveFile) {
      return api.saveFile(filePath, content ?? '');
    }

    if (api?.saveFileAs) {
      return api.saveFileAs({
        content: content ?? '',
        suggestedName: suggestedName ?? fileName ?? '',
      });
    }

    return { success: false, error: 'Electron save API not available' };
  }

  const resolvedName = suggestedName || fileName || getLastFileInfo().fileName || 'Untitled.txt';
  downloadTextFile({ content: content ?? '', fileName: resolvedName });
  return { success: true, fileName: resolvedName };
}

function maybeRememberLastFileAfterSave({ filePath, fileName, content }) {
  if (filePath) rememberLastFile({ filePath, content });
  else if (fileName) rememberLastFile({ fileName, content });
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

        const filePath = String(result.filePath || '');
        const rawText = String(result.content ?? '');
        if (isEncryptedText(rawText)) {
          const pwd = getSessionPassword(filePath);
          if (pwd) {
            try {
              const plaintext = await decryptText({ encryptedText: rawText, password: pwd });
              return { success: true, filePath, content: plaintext };
            } catch {
              setSessionPassword(filePath, '');
            }
          }

          return { success: true, filePath, encrypted: true, encryptedText: rawText };
        }
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

    const rawText = String(result.content ?? '');
    const fileName = String(result.fileName || '');
    if (isEncryptedText(rawText)) {
      const pwd = getSessionPassword(fileName);
      if (pwd) {
        try {
          const plaintext = await decryptText({ encryptedText: rawText, password: pwd });
          return { success: true, fileName, content: plaintext };
        } catch {
          setSessionPassword(fileName, '');
        }
      }
      return { success: true, fileName, encrypted: true, encryptedText: rawText };
    }
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
        const rawText = String(result.content ?? '');
        rememberLastFile({ filePath, content: rawText });

        if (isEncryptedText(rawText)) {
          const pwd = getSessionPassword(filePath);
          if (pwd) {
            try {
              const plaintext = await decryptText({ encryptedText: rawText, password: pwd });
              return { success: true, filePath, content: plaintext };
            } catch {
              setSessionPassword(filePath, '');
            }
          }
          return { success: true, filePath, encrypted: true, encryptedText: rawText };
        }

        return { success: true, filePath, content: rawText };
      }
      return result;
    }

    return { success: false, error: 'Electron read API not available' };
  }

  if (!last.content) return { success: false };

  const rawText = String(last.content ?? '');
  const fileName = String(last.fileName || 'Untitled.txt');

  if (isEncryptedText(rawText)) {
    const pwd = getSessionPassword(fileName);
    if (pwd) {
      try {
        const plaintext = await decryptText({ encryptedText: rawText, password: pwd });
        return { success: true, fileName, content: plaintext };
      } catch {
        setSessionPassword(fileName, '');
      }
    }
    return { success: true, fileName, encrypted: true, encryptedText: rawText };
  }

  return { success: true, fileName, content: rawText };
}

export async function saveFile({ filePath, fileName, content }) {
  const password = getSessionPassword(filePath);
  const shouldEncrypt = Boolean(password);

  const toWrite = shouldEncrypt
    ? await encryptText({ plaintext: content ?? '', password })
    : String(content ?? '');

  const result = await platformSaveTextFile({ filePath, fileName, content: toWrite, suggestedName: fileName });
  if (result?.success) {
    const nextFilePath = String(result.filePath || filePath || '');
    const nextFileName = String(result.fileName || fileName || '');
    maybeRememberLastFileAfterSave({
      filePath: nextFilePath,
      fileName: nextFileName,
      content: toWrite,
    });

    if (shouldEncrypt && nextFilePath) {
      setSessionPassword(nextFilePath, password);
    }
  }
  return result;
}

export async function saveFileAs({ content, suggestedName, sourceFilePath }) {
  const password = getSessionPassword(sourceFilePath);
  const shouldEncrypt = Boolean(password);

  const toWrite = shouldEncrypt
    ? await encryptText({ plaintext: content ?? '', password })
    : String(content ?? '');

  if (!isElectron()) {
    const proposed = suggestedName || getLastFileInfo().fileName || 'Untitled.txt';
    const name = promptForFileName(proposed);
    if (!name) return { success: false };

    const webResult = await platformSaveTextFile({ fileName: name, content: toWrite, suggestedName: name });
    if (webResult?.success) {
      maybeRememberLastFileAfterSave({ fileName: name, content: toWrite });
      if (shouldEncrypt) setSessionPassword(name, password);
    }
    return { success: Boolean(webResult?.success), fileName: name };
  }

  const result = await platformSaveTextFile({ content: toWrite, suggestedName: suggestedName ?? '' });
  if (result?.success) {
    const nextFilePath = String(result.filePath || '');
    maybeRememberLastFileAfterSave({ filePath: nextFilePath, content: toWrite });
    if (shouldEncrypt && nextFilePath) setSessionPassword(nextFilePath, password);
  }
  return result;
}

export async function encryptAndSaveFile({ filePath, fileName, plaintext, password, suggestedName }) {
  const encrypted = await encryptText({ plaintext: plaintext ?? '', password });
  const result = await platformSaveTextFile({ filePath, fileName, content: encrypted, suggestedName });
  if (result?.success) {
    const nextFilePath = String(result.filePath || filePath || '');
    const nextFileName = String(result.fileName || fileName || '');
    maybeRememberLastFileAfterSave({ filePath: nextFilePath, fileName: nextFileName, content: encrypted });
    if (nextFilePath) setSessionPassword(nextFilePath, password);
    else if (nextFileName) setSessionPassword(nextFileName, password);
  }
  return result;
}

export async function decryptAndOpenEncryptedText({ filePath, encryptedText, password }) {
  try {
    const plaintext = await decryptText({ encryptedText: encryptedText ?? '', password });
    setSessionPassword(filePath, password);
    return { success: true, content: plaintext };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}
