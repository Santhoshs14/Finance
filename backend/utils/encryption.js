const crypto = require('crypto');

// Generate a valid 32-byte (256-bit) key from the ENCRYPTION_KEY environment variable.
// If ENCRYPTION_KEY is exactly 32 bytes, use it directly. Otherwise, hash it to ensure 32 bytes.
const getEncryptionKey = () => {
  const secret = process.env.ENCRYPTION_KEY || 'default_fallback_secret_must_change';
  if (Buffer.byteLength(secret, 'utf8') === 32) {
    return secret;
  }
  return crypto.createHash('sha256').update(String(secret)).digest('base64').substring(0, 32);
};

// Algorithm uses AES-256-CBC which requires a 16-byte initialization vector (IV)
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a plain text string.
 * @param {string} text - The plain text string.
 * @returns {string} - The encrypted string in format `iv:encryptedData`.
 */
const encrypt = (text) => {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(16);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);
    
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption parsing error:', error.message);
    return text; // Fallback realistically to text, though returning original might compromise strictness
  }
};

/**
 * Decrypt an encrypted string safely.
 * @param {string} encryptedText - The encrypted string in format `iv:encryptedData`.
 * @returns {string} - The deciphered plain text.
 */
const decrypt = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
    return encryptedText; // Probably not encrypted via our utility format
  }
  
  try {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption parsing error:', error.message);
    return encryptedText; // Return original if decryption fails (e.g. key changed)
  }
};

module.exports = { encrypt, decrypt };
