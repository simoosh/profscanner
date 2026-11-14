#!/usr/bin/env node

/**
 * Script de déchiffrement standalone pour ProfScanner
 * 
 * Déchiffre un fichier .docx chiffré avec AES-256-GCM.
 * 
 * Usage :
 *   node decrypt-docx.mjs <clé-base64> <iv-json> <fichier-base64.txt> <sortie.docx>
 * 
 * Exemple :
 *   node decrypt-docx.mjs "abc123...==" "[1,2,3,4,5,6,7,8,9,10,11,12]" encrypted.txt output.docx
 * 
 * La clé base64 peut être obtenue depuis l'app via :
 *   import { exportKeyAsBase64 } from './services/cryptoService';
 *   const key = await exportKeyAsBase64(user.uid);
 *   console.log('Clé:', key);
 * 
 * L'IV est stocké dans Firestore sous le champ `docxIv` du scan.
 */

import { createDecipheriv } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);

if (args.length < 4) {
  console.error(`
╔══════════════════════════════════════════════════╗
║    ProfScanner — Déchiffreur de Documents DOCX  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  Usage :                                         ║
║    node decrypt-docx.mjs <clé> <iv> <in> <out>   ║
║                                                  ║
║  Arguments :                                     ║
║    <clé>  Clé AES-256 en base64                  ║
║    <iv>   IV en JSON (ex: [1,2,3,...])            ║
║    <in>   Fichier chiffré (texte base64)          ║
║    <out>  Fichier de sortie (.docx)               ║
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);
  process.exit(1);
}

const [keyB64, ivJson, inputFile, outputFile] = args;

try {
  // 1. Lire la clé
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error(`Clé invalide : ${key.length} octets (attendu 32)`);
  }

  // 2. Lire l'IV
  const ivArray = JSON.parse(ivJson);
  const iv = Buffer.from(ivArray);
  if (iv.length !== 12) {
    throw new Error(`IV invalide : ${iv.length} octets (attendu 12)`);
  }

  // 3. Lire le fichier chiffré (base64)
  const encryptedBase64 = readFileSync(inputFile, 'utf-8').trim();
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');

  // AES-256-GCM : les 16 derniers octets sont l'auth tag
  const authTagLength = 16;
  if (encryptedBuffer.length < authTagLength) {
    throw new Error('Fichier trop court pour contenir un auth tag GCM');
  }

  const ciphertext = encryptedBuffer.subarray(0, encryptedBuffer.length - authTagLength);
  const authTag = encryptedBuffer.subarray(encryptedBuffer.length - authTagLength);

  // 4. Déchiffrer
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  // 5. Écrire le fichier
  writeFileSync(outputFile, decrypted);
  
  console.log(`✅ Fichier déchiffré avec succès → ${outputFile}`);
  console.log(`   Taille : ${(decrypted.length / 1024).toFixed(1)} KB`);

} catch (error) {
  console.error(`❌ Erreur de déchiffrement :`, error.message);
  process.exit(1);
}
