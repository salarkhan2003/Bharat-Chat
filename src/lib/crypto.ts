/**
 * Simplified Signal-like Encryption using Web Crypto API
 * In a real production app, use @signalapp/libsignal-client or similar.
 */

// Helper to convert array buffer to base64
function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// Helper to convert base64 to array buffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"]
  );
  
  const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  
  return {
    publicKey: bufferToBase64(publicKey),
    privateKey: bufferToBase64(privateKey),
  };
}

export async function encryptMessage(text: string, recipientPublicKeyBase64: string) {
  const publicKeyBuffer = base64ToBuffer(recipientPublicKeyBase64);
  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    publicKeyBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );

  // For demonstration, we generate a temporary sender key pair per session or message
  const senderKeyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  const sharedKey = await window.crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    senderKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    encodedText
  );

  const senderPublicKey = await window.crypto.subtle.exportKey("spki", senderKeyPair.publicKey);

  return {
    content: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv),
    senderPublicKey: bufferToBase64(senderPublicKey),
  };
}

export async function decryptMessage(encrypted: { content: string, iv: string, senderPublicKey: string }, myPrivateKeyBase64: string) {
  const privateKeyBuffer = base64ToBuffer(myPrivateKeyBase64);
  const privateKey = await window.crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  const senderPublicKeyBuffer = base64ToBuffer(encrypted.senderPublicKey);
  const senderPublicKey = await window.crypto.subtle.importKey(
    "spki",
    senderPublicKeyBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );

  const sharedKey = await window.crypto.subtle.deriveKey(
    { name: "ECDH", public: senderPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"]
  );

  const iv = base64ToBuffer(encrypted.iv);
  const cipherBuffer = base64ToBuffer(encrypted.content);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    sharedKey,
    cipherBuffer
  );

  return new TextDecoder().decode(decryptedBuffer);
}
