export const ENCRYPTION_MAGIC = 'SCRIBEFOLD_ENCRYPTED_V1';
export const ENCRYPTION_MAGIC_V2 = 'SCBv2';

function toBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(String(base64 || ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64EncodeUtf8(text) {
  const enc = new TextEncoder();
  return toBase64(enc.encode(String(text ?? '')));
}

function base64DecodeUtf8(base64) {
  const bytes = fromBase64(base64);
  const dec = new TextDecoder();
  return dec.decode(bytes);
}

function getCrypto() {
  const c = typeof window !== 'undefined' ? window.crypto : null;
  if (!c?.subtle) throw new Error('Web Crypto API not available');
  return c;
}

async function deriveAesKey({ password, salt, iterations = 210000 }) {
  const crypto = getCrypto();
  const enc = new TextEncoder();

  const passwordBytes = enc.encode(String(password ?? ''));
  let keyMaterial;
  try {
    keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
  } finally {
    passwordBytes.fill(0);
  }

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedText(text) {
  if (typeof text !== 'string') return false;
  return text.startsWith(ENCRYPTION_MAGIC + '\n') || text.startsWith(ENCRYPTION_MAGIC_V2 + '\n');
}

export async function encryptText({ plaintext, password }) {
  const crypto = getCrypto();
  const enc = new TextEncoder();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveAesKey({ password, salt });

  const plainBytes = enc.encode(String(plaintext ?? ''));
  let cipherBuf;
  try {
    cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plainBytes
    );
  } finally {
    plainBytes.fill(0);
  }

  const encryptedBytes = new Uint8Array(cipherBuf);
  const tagLength = 16;
  const tag = encryptedBytes.slice(Math.max(0, encryptedBytes.length - tagLength));
  const ciphertext = encryptedBytes.slice(0, Math.max(0, encryptedBytes.length - tagLength));

  const payload = {
    v: 1,
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iter: 210000,
    alg: 'AES-GCM',
    s: toBase64(salt),
    i: toBase64(iv),
    t: toBase64(tag),
    d: toBase64(ciphertext),
  };

  salt.fill(0);
  iv.fill(0);
  encryptedBytes.fill(0);
  tag.fill(0);
  ciphertext.fill(0);

  return `${ENCRYPTION_MAGIC_V2}\n${base64EncodeUtf8(JSON.stringify(payload))}`;
}

export async function decryptText({ encryptedText, password }) {
  if (!isEncryptedText(encryptedText)) {
    throw new Error('File is not in Scribefold encrypted format');
  }

  const crypto = getCrypto();
  const dec = new TextDecoder();

  const [header, body] = encryptedText.split(/\n(.+)/s);

  let payload;
  if (header === ENCRYPTION_MAGIC_V2) {
    payload = JSON.parse(base64DecodeUtf8(body));
  } else {
    payload = JSON.parse(body);
  }

  const salt = fromBase64(payload.salt || payload.s);
  const iv = fromBase64(payload.iv || payload.i);
  const iterations = payload.iter || 210000;

  let ct;
  if (payload.ct) {
    // Legacy: combined ciphertext+tag
    ct = fromBase64(payload.ct);
  } else {
    // SCBv2: ciphertext + tag stored separately
    const ciphertext = fromBase64(payload.d);
    const tag = fromBase64(payload.t);
    ct = new Uint8Array(ciphertext.length + tag.length);
    ct.set(ciphertext, 0);
    ct.set(tag, ciphertext.length);

    ciphertext.fill(0);
    tag.fill(0);
  }

  const key = await deriveAesKey({ password, salt, iterations });

  let plainBuf;
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    );
  } finally {
    if (ct?.fill) ct.fill(0);
    if (salt?.fill) salt.fill(0);
    if (iv?.fill) iv.fill(0);
  }

  const plaintext = dec.decode(plainBuf);
  return plaintext;
}
