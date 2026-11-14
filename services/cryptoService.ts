/**
 * CryptoService — Chiffrement bout-en-bout AES-256-GCM
 * 
 * Utilise la Web Crypto API native (pas de dépendance npm).
 * La clé est dérivée du UID Firebase de l'utilisateur via PBKDF2.
 * Chaque fichier utilise un IV (Initialization Vector) unique de 12 octets.
 */

const SALT = "profscanner-v1-e2e-salt-2026";
const ITERATIONS = 100000;

/**
 * Dérive une clé AES-256 à partir du UID utilisateur
 */
export async function deriveKey(uid: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(uid),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(SALT),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable — pour pouvoir exporter la clé
    ["encrypt", "decrypt"]
  );
}

/**
 * Chiffre une chaîne de texte (ex: HTML content)
 * Retourne le texte chiffré en base64 + l'IV en tableau de nombres
 */
export async function encryptText(
  plaintext: string,
  uid: string
): Promise<{ encryptedBase64: string; iv: number[] }> {
  const key = await deriveKey(uid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  // Convertir ArrayBuffer → Base64
  const encryptedArray = new Uint8Array(encrypted);
  const encryptedBase64 = btoa(
    String.fromCharCode(...encryptedArray)
  );

  return {
    encryptedBase64,
    iv: Array.from(iv),
  };
}

/**
 * Déchiffre une chaîne de texte chiffrée en base64
 */
export async function decryptText(
  encryptedBase64: string,
  iv: number[],
  uid: string
): Promise<string> {
  const key = await deriveKey(uid);
  const ivArray = new Uint8Array(iv);

  // Base64 → ArrayBuffer
  const encryptedString = atob(encryptedBase64);
  const encryptedArray = new Uint8Array(encryptedString.length);
  for (let i = 0; i < encryptedString.length; i++) {
    encryptedArray[i] = encryptedString.charCodeAt(i);
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivArray },
    key,
    encryptedArray
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Chiffre un Blob (ex: fichier DOCX)
 * Retourne le blob chiffré en base64 + l'IV
 */
export async function encryptBlob(
  blob: Blob,
  uid: string
): Promise<{ encryptedBase64: string; iv: number[] }> {
  const key = await deriveKey(uid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await blob.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  const encryptedArray = new Uint8Array(encrypted);
  
  // Pour les gros fichiers, on utilise une approche par chunks pour le btoa
  let encryptedBase64 = '';
  const chunkSize = 8192;
  for (let i = 0; i < encryptedArray.length; i += chunkSize) {
    const chunk = encryptedArray.subarray(i, i + chunkSize);
    encryptedBase64 += String.fromCharCode(...chunk);
  }
  encryptedBase64 = btoa(encryptedBase64);

  return {
    encryptedBase64,
    iv: Array.from(iv),
  };
}

/**
 * Déchiffre un Blob chiffré en base64
 */
export async function decryptBlob(
  encryptedBase64: string,
  iv: number[],
  uid: string
): Promise<Blob> {
  const key = await deriveKey(uid);
  const ivArray = new Uint8Array(iv);

  const encryptedString = atob(encryptedBase64);
  const encryptedArray = new Uint8Array(encryptedString.length);
  for (let i = 0; i < encryptedString.length; i++) {
    encryptedArray[i] = encryptedString.charCodeAt(i);
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivArray },
    key,
    encryptedArray
  );

  return new Blob([decrypted], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Exporte la clé AES en base64 (pour déchiffrement externe)
 */
export async function exportKeyAsBase64(uid: string): Promise<string> {
  const key = await deriveKey(uid);
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const keyArray = new Uint8Array(rawKey);
  return btoa(String.fromCharCode(...keyArray));
}
