"use client";

export interface EncryptedEnvelope {
  version: 1;
  alg: "AES-256-GCM";
  ivBase64: string;
  ciphertextBase64: string;
}

export interface EncryptedRecordResult {
  envelope: EncryptedEnvelope;
  envelopeBytes: Uint8Array;
  dekRawBytes: Uint8Array;
  recordCommitment: bigint;
  recordCommitmentHex: `0x${string}`;
}

export interface HospitalKeyRecord {
  address: string;
  publicKeyHex: `0x${string}`;
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
}

const KEY_DB_NAME = "qlo-keys-v1";
const KEY_STORE = "ecdh-keys";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as `0x${string}`;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("Invalid hex length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function computeRecordCommitment(envelopeBytes: Uint8Array): Promise<{
  recordCommitment: bigint;
  recordCommitmentHex: `0x${string}`;
}> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(envelopeBytes)));
  const hex = Array.from(digest)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const recordCommitment = BigInt("0x" + hex) >> 8n;
  const recordCommitmentHex = ("0x" + recordCommitment.toString(16).padStart(64, "0")) as `0x${string}`;
  return { recordCommitment, recordCommitmentHex };
}

export async function encryptClinicalPayload(payload: unknown): Promise<EncryptedRecordResult> {
  const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    dek,
    toArrayBuffer(plaintext)
  );
  const dekRawBytes = new Uint8Array(await crypto.subtle.exportKey("raw", dek));

  const envelope: EncryptedEnvelope = {
    version: 1,
    alg: "AES-256-GCM",
    ivBase64: toBase64(iv),
    ciphertextBase64: toBase64(new Uint8Array(encryptedBuf)),
  };

  const envelopeBytes = new TextEncoder().encode(JSON.stringify(envelope));
  const { recordCommitment, recordCommitmentHex } = await computeRecordCommitment(envelopeBytes);

  return {
    envelope,
    envelopeBytes,
    dekRawBytes,
    recordCommitment,
    recordCommitmentHex,
  };
}

export async function decryptClinicalPayload<T = unknown>(
  envelope: EncryptedEnvelope,
  dekRawBytes: Uint8Array
): Promise<T> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(dekRawBytes),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const iv = fromBase64(envelope.ivBase64);
  const ciphertext = fromBase64(envelope.ciphertextBase64);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(KEY_STORE)) {
        req.result.createObjectStore(KEY_STORE, { keyPath: "address" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getOrCreateHospitalKeypair(address: string): Promise<HospitalKeyRecord> {
  const normalized = address.toLowerCase();
  const db = await openKeyDb();

  const existing = await new Promise<HospitalKeyRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, "readonly");
    const req = tx.objectStore(KEY_STORE).get(normalized);
    req.onsuccess = () => resolve(req.result as HospitalKeyRecord | undefined);
    req.onerror = () => reject(req.error);
  });

  if (existing) {
    db.close();
    return existing;
  }

  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

  const rec: HospitalKeyRecord = {
    address: normalized,
    publicKeyHex: bytesToHex(rawPub),
    privateJwk,
    publicJwk,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, "readwrite");
    tx.objectStore(KEY_STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return rec;
}

async function deriveDekWrapKey(
  ecdhPrivateKey: CryptoKey,
  peerRawPubBytes: Uint8Array
): Promise<CryptoKey> {
  const peerPubKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(peerRawPubBytes),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peerPubKey },
    ecdhPrivateKey,
    256
  );
  const hkdfKey = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info: new TextEncoder().encode("qlo-dek-wrap-v1"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Wraps a 32-byte record DEK for a hospital's 65-byte ECDH P-256 public key.
 * Output binary format: ephemeralPub (65B) || wrapIv (12B) || wrappedDek (48B) = 125 bytes.
 */
export async function wrapDekForHospital(
  dekRawBytes: Uint8Array,
  hospitalPubKeyHex: string
): Promise<`0x${string}`> {
  const hospitalPubBytes = hexToBytes(hospitalPubKeyHex);
  if (hospitalPubBytes.length !== 65 || hospitalPubBytes[0] !== 0x04) {
    throw new Error("Hospital public key must be a 65-byte uncompressed P-256 key (0x04...)");
  }

  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const ephPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const wrapKey = await deriveDekWrapKey(ephemeral.privateKey, hospitalPubBytes);
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(wrapIv) },
    wrapKey,
    toArrayBuffer(dekRawBytes)
  );
  const wrapped = new Uint8Array(wrappedBuf);

  const packed = new Uint8Array(ephPubRaw.length + wrapIv.length + wrapped.length);
  packed.set(ephPubRaw, 0);
  packed.set(wrapIv, ephPubRaw.length);
  packed.set(wrapped, ephPubRaw.length + wrapIv.length);
  return bytesToHex(packed);
}

export async function unwrapDekForHospital(
  encryptedDekHex: string,
  hospitalPrivateJwk: JsonWebKey
): Promise<Uint8Array> {
  const packed = hexToBytes(encryptedDekHex);
  if (packed.length < 65 + 12 + 32) {
    throw new Error("Invalid encrypted DEK length");
  }
  const ephPubRaw = packed.slice(0, 65);
  const wrapIv = packed.slice(65, 77);
  const wrappedDek = packed.slice(77);

  const privKey = await crypto.subtle.importKey(
    "jwk",
    hospitalPrivateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  const wrapKey = await deriveDekWrapKey(privKey, ephPubRaw);
  const rawDekBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(wrapIv) },
    wrapKey,
    toArrayBuffer(wrappedDek)
  );
  return new Uint8Array(rawDekBuf);
}
