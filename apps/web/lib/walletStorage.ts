'use client';

import { type Hex, bytesToHex, hexToBytes } from 'viem';

const STORAGE_KEY = 'autobridge.wallet.v1';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface StoredWalletMeta {
  ownerAddress: string;
  accountSalt: Hex;
  smartAccountAddress?: string;
}

interface StoredWalletRecord extends StoredWalletMeta {
  version: 1;
  encryption: {
    ciphertext: string;
    iv: string;
    salt: string;
  };
}

function getWindow(): Window | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window;
}

function bytesToBase64(bytes: Uint8Array): string {
  const win = getWindow();
  if (win) {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return win.btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value: string): Uint8Array {
  const win = getWindow();
  if (win) {
    const binary = win.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(value, 'base64'));
}

function cloneUint8Array(bytes: Uint8Array): Uint8Array {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return view;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function importPasswordKey(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', textEncoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
}

async function deriveEncryptionKey(passwordKey: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
  const saltBuffer = new ArrayBuffer(salt.length);
  new Uint8Array(saltBuffer).set(salt);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 200_000, // Increased from 120k for better security
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptMnemonic(mnemonic: string, password: string) {
  const passwordKey = await importPasswordKey(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await deriveEncryptionKey(passwordKey, salt);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encodedMnemonic = textEncoder.encode(mnemonic);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, aesKey, toArrayBuffer(encodedMnemonic));
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
  };
}

async function decryptMnemonic(encryption: StoredWalletRecord['encryption'], password: string): Promise<string> {
  const passwordKey = await importPasswordKey(password);
  const saltBytes = base64ToBytes(encryption.salt);
  const aesKey = await deriveEncryptionKey(passwordKey, saltBytes);
  const iv = cloneUint8Array(base64ToBytes(encryption.iv));
  const cipherBytes = cloneUint8Array(base64ToBytes(encryption.ciphertext));
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, aesKey, toArrayBuffer(cipherBytes));
  return textDecoder.decode(plaintext);
}

function readStoredRecord(): StoredWalletRecord | null {
  const win = getWindow();
  if (!win) return null;
  const raw = win.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredWalletRecord;
    if (parsed.version !== 1 || !parsed.ownerAddress || !parsed.accountSalt) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse stored wallet record', error);
    return null;
  }
}

export function getStoredWalletMeta(): StoredWalletMeta | null {
  const record = readStoredRecord();
  if (!record) return null;
  return {
    ownerAddress: record.ownerAddress,
    accountSalt: record.accountSalt,
    smartAccountAddress: record.smartAccountAddress,
  };
}

export async function persistWallet(
  mnemonic: string,
  meta: StoredWalletMeta,
  password: string,
): Promise<void> {
  const win = getWindow();
  if (!win) return;
  const encryption = await encryptMnemonic(mnemonic, password);
  const record: StoredWalletRecord = {
    version: 1,
    ownerAddress: meta.ownerAddress,
    accountSalt: meta.accountSalt,
    smartAccountAddress: meta.smartAccountAddress,
    encryption,
  };
  win.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export async function unlockWallet(password: string): Promise<{ mnemonic: string; meta: StoredWalletMeta } | null> {
  const record = readStoredRecord();
  if (!record) return null;
  const mnemonic = await decryptMnemonic(record.encryption, password);
  return { mnemonic, meta: { ownerAddress: record.ownerAddress, accountSalt: record.accountSalt, smartAccountAddress: record.smartAccountAddress } };
}

export function updateStoredSmartAccountAddress(address: string): void {
  const win = getWindow();
  if (!win) return;
  const record = readStoredRecord();
  if (!record) return;
  record.smartAccountAddress = address as Hex;
  win.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

export function clearStoredWallet(): void {
  const win = getWindow();
  if (!win) return;
  win.localStorage.removeItem(STORAGE_KEY);
}

export function generateHexSalt(): Hex {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(randomBytes);
}

export function parseHexSalt(hex: string): Hex {
  return bytesToHex(hexToBytes(hex as Hex));
}

export function formatAddress(address: string): string {
  if (!address || address === '0x') return '—';
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
