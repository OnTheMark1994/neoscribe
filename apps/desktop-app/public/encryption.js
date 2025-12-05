const crypto = require('crypto');
const argon2 = require('argon2');

const ALGORITHMS = {
  PBKDF2: 'pbkdf2',
  ARGON2: 'argon2'
};

async function encryptWithPBKDF2(plaintext, password) {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  const result = {
    algorithm: ALGORITHMS.PBKDF2,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted: encrypted
  };
  
  return JSON.stringify(result);
}

function decryptWithPBKDF2(encryptedData, password) {
  const data = JSON.parse(encryptedData);
  const salt = Buffer.from(data.salt, 'hex');
  const iv = Buffer.from(data.iv, 'hex');
  const authTag = Buffer.from(data.authTag, 'hex');
  const encrypted = data.encrypted;
  
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function encryptWithArgon2(plaintext, password) {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    salt: salt,
    hashLength: 32,
    timeCost: 3,
    memoryCost: 65536,
    parallelism: 4,
    raw: true
  });
  
  const cipher = crypto.createCipheriv('aes-256-gcm', hash, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  const result = {
    algorithm: ALGORITHMS.ARGON2,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted: encrypted
  };
  
  return JSON.stringify(result);
}

async function decryptWithArgon2(encryptedData, password) {
  const data = JSON.parse(encryptedData);
  const salt = Buffer.from(data.salt, 'hex');
  const iv = Buffer.from(data.iv, 'hex');
  const authTag = Buffer.from(data.authTag, 'hex');
  const encrypted = data.encrypted;
  
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    salt: salt,
    hashLength: 32,
    timeCost: 3,
    memoryCost: 65536,
    parallelism: 4,
    raw: true
  });
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', hash, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function encrypt(plaintext, password, algorithm = ALGORITHMS.ARGON2) {
  if (algorithm === ALGORITHMS.PBKDF2) {
    return await encryptWithPBKDF2(plaintext, password);
  } else if (algorithm === ALGORITHMS.ARGON2) {
    return await encryptWithArgon2(plaintext, password);
  } else {
    throw new Error('Unknown encryption algorithm');
  }
}

async function decrypt(encryptedData, password) {
  try {
    const data = JSON.parse(encryptedData);
    
    if (data.algorithm === ALGORITHMS.PBKDF2) {
      return decryptWithPBKDF2(encryptedData, password);
    } else if (data.algorithm === ALGORITHMS.ARGON2) {
      return await decryptWithArgon2(encryptedData, password);
    } else {
      throw new Error('Unknown encryption algorithm');
    }
  } catch (error) {
    throw new Error('Failed to decrypt: ' + error.message);
  }
}

module.exports = {
  encrypt,
  decrypt,
  ALGORITHMS
};
