import crypto from "crypto";

// AES-256-GCM encryption/decryption utilities for sensitive tokens
// Requires env var GITHUB_TOKEN_ENCRYPTION_KEY as 32-byte key (base64 or hex)

const getKey = (): Buffer => {
  const raw = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || "";
  if (!raw) throw new Error("Missing GITHUB_TOKEN_ENCRYPTION_KEY env var");
  // Support base64 or hex; fallback to utf8 if exactly 32 bytes provided
  let key: Buffer;
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else if (/^[A-Za-z0-9+/=]+$/.test(raw)) {
    try {
      const b64 = Buffer.from(raw, "base64");
      if (b64.length === 32) return b64;
    } catch {
      // ignore - will fall through to next check
    }
    key = Buffer.from(raw);
  } else {
    key = Buffer.from(raw);
  }
  if (key.length !== 32) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY must be 32 bytes (use 32-byte base64 or hex)");
  }
  return key;
};

export const encrypt = (plaintext: string): { ciphertext: string; iv: string; tag: string } => {
  const key = getKey();
  const iv = crypto.randomBytes(12); // GCM nonce length
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
};

export const decrypt = (ciphertext: string, iv: string, tag: string): string => {
  const key = getKey();
  const ivBuf = Buffer.from(iv, "base64");
  const tagBuf = Buffer.from(tag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(tagBuf);
  const dec = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]);
  return dec.toString("utf8");
};
