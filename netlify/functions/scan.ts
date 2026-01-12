import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// --- CONFIGURATION STRICTE ---
// Note: Le nom officiel actuel du modèle Flash Next-Gen est "gemini-2.0-flash-exp".
// Si tu as un accès spécial à "gemini-2.5-flash", remplace-le ici.
const MODEL_NAME = "gemini-2.5-flash-lite";

const handler: Handler = async (event) => {
  // 1. FORÇAGE DU CHARGEMENT .ENV (Fix Windows/Netlify)
  // On remonte d'un niveau (functions) puis encore d'un niveau (netlify) pour trouver la racine
  const envPath = path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath });

  console.log("--- DÉBUT SCAN (Mode Next-Gen) ---");

  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    // 2. DEBUG DE LA CLÉ (Pour être sûr qu'on lit le fichier)
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error(`❌ ERREUR: Impossible de lire .env à: ${envPath}`);
      throw new Error("Clé API introuvable dans l'environnement local.");
    }

    // Affiche les 4 premiers caractères pour vérifier (ex: "AIza...")
    console.log(`✅ Clé API chargée : ${apiKey.substring(0, 4)}... (Longueur: ${apiKey.length})`);
    console.log(`🚀 Modèle utilisé : ${MODEL_NAME}`);

    // 3. Traitement
    const { imageBase64, mimeType } = JSON.parse(event.body || '{}');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: `
      Rôle : Tu es un expert en OCR et en formatage de documents académiques pour Microsoft Word.
      Tâche : Transcris l'image fournie (manuscrite ou imprimée) en code HTML complet.
      
      Contraintes Techniques STRICTES :
      1. Structure : Le document doit être un fichier HTML valide avec <html>, <head>, <body>.
      2. Compatibilité Word :
         - Dans le <head>, ajoute <meta charset="UTF-8">.
         - Ajoute le style CSS suivant pour assurer la compatibilité Word :
           body { font-family: 'Times New Roman', serif; font-size: 12pt; }
           .rtl { direction: rtl; text-align: right; unicode-bidi: embed; }
           .ltr { direction: ltr; text-align: left; unicode-bidi: embed; }
      3. Langues : Détecte automatiquement la langue dominante (Arabe/Français/Anglais). Si c'est de l'arabe, applique la classe "rtl" au body ou aux paragraphes.
      4. Mathématiques :
         - Pour les formules simples (x², indices), utilise les balises HTML <sup> et <sub>.
         - Pour les vecteurs et symboles complexes, utilise les entités HTML unicode (ex: &rarr; pour flèche).
         - N'utilise PAS de LaTeX ($...$) brut, car Word ne le lit pas sans plugin. Essaie de rendre visuellement la formule en HTML/CSS.
      5. Mise en page : Respecte les sauts de ligne, les numérotations (1, 2, a, b) et le gras/italique de l'image originale.
      
      Output : Donne UNIQUEMENT le code HTML, sans balises markdown (html), juste le code brut.
      
        Interdit : Markdown, Introduction, Commentaires.
        Erreur : Si illisible, renvoie "ERROR_UNREADABLE".
      `
    });

    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } },
      "Transcris ce document."
    ]);

    const html = result.response.text().replace(/```html/g, '').replace(/```/g, '').trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ html: html }),
    };

  } catch (error: any) {
    console.error("❌ CRASH BACKEND:", error);
    
    // Si c'est une erreur 404 sur le modèle, on prévient spécifiquement
    if (error.message.includes("404") || error.message.includes("Not Found")) {
        console.error("⚠️ LE MODÈLE N'EXISTE PAS. Vérifie le nom 'MODEL_NAME' en haut du fichier.");
    }

    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ error: error.message || "Erreur serveur" }) 
    };
  }
};

export { handler };