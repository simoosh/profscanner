import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIGURATION DU MODÈLE ---
// On utilise le modèle 2.0 Flash Experimental qui est disponible et gratuit
const MODEL_NAME = "	gemini-2.5-flash-lite";

const handler: Handler = async (event) => {
  // Headers pour autoriser l'accès depuis n'importe où (CORS)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Gestion de la requête préliminaire (OPTIONS)
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  
  // Vérification de la méthode
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    // 1. RÉCUPÉRATION DE LA CLÉ
    // Sur Netlify (En ligne), cette variable est injectée automatiquement via l'interface
    // En local, 'netlify dev' la lit depuis ton fichier .env automatiquement
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("❌ ERREUR: La variable GEMINI_API_KEY est introuvable.");
      throw new Error("Configuration serveur incomplète (Clé API manquante)");
    }

    // 2. Traitement des données
    const body = JSON.parse(event.body || '{}');
    const { imageBase64, mimeType } = body;

    if (!imageBase64) throw new Error("Aucune image reçue.");

    // 3. Appel à Google Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: `
        Rôle : OCR Strict.
        Output : HTML uniquement (<h1>, <p>, <ul>).
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
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ error: error.message || "Erreur serveur" }) 
    };
  }
};

export { handler };