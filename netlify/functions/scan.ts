import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// On reste sur le modèle Flash Exp pour la vitesse maximale
const MODEL_NAME = "gemini-2.5-flash";

const handler: Handler = async (event) => {
  // Chargement .env sécurisé
  const envPath = path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath });

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Clé API manquante.");

    const { imageBase64, mimeType } = JSON.parse(event.body || '{}');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: `
      Rôle : Expert Mise en Page Word (HTML Legacy).
      Objectif : Reproduire l'image FIDÈLEMENT pour Word 2016+.

      RÈGLE D'OR : Word gère mal le mélange Texte + Tableaux.
      
      STRATÉGIE "LIGNE-TABLEAU" (À appliquer si une ligne contient des maths verticales) :
      Si une ligne contient une fraction verticale ou un grand symbole, NE PAS utiliser de balise <p>.
      Crée un TABLEAU GLOBAL pour toute la ligne (border=0) :
      - Une cellule pour le texte de gauche.
      - Une cellule pour la fraction.
      - Une cellule pour la suite.
      Tout doit être aligné : vertical-align: middle.

      COMMENT DESSINER LES ÉLÉMENTS :
      
      1. FRACTIONS (Verticales) :
         <table cellspacing="0" cellpadding="0" style="display:inline-table; vertical-align:middle;">
            <tr><td align="center" style="border-bottom:1px solid black; padding:0 2px;">NUMÉRATEUR</td></tr>
            <tr><td align="center" style="padding:0 2px;">DÉNOMINATEUR</td></tr>
         </table>

      2. SYSTÈMES (Accolade { ) :
         Utilise un tableau à 2 colonnes.
         Col 1 : <span style="font-size:300%; vertical-align:middle;">{</span>
         Col 2 : Les équations séparées par <br>.

      3. NOTES (Encadrés rouges) :
         <span style="border:1px solid red; color:red; border-radius:50%; padding:1px 4px; font-size:0.8em; margin-left:5px;">0,25</span>

      4. TEXTE SIMPLE :
         Si la ligne n'a pas de maths complexes, utilise simplement <p>.

      Gère le RTL pour l'arabe si présent.
      Ne mets JAMAIS de MathML (<math>), ça casse sur Word 2016.`
    });

    // On ne met pas de await Promise.race ici pour laisser le max de temps possible à Netlify (10s sur Free, parfois 26s)
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } },
      "Transcris ce document en code html en essayant de reproduire la même mise en forme que sur l'image (le texte ne doit pas être manuscrit). le but est de lire le fichier html dans word afin d'avoir une transcription parfaite du document manuscrit (comme si un humain allait taper manuellement et donner le style manuellement à ce document manuscrit joint)."
    ]);

    const html = result.response.text().replace(/```html/g, '').replace(/```/g, '').trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ html: html }),
    };

  } catch (error: any) {
    console.error("ERREUR SCAN:", error);
    
    // Gestion spécifique du Timeout
    if (error.message && error.message.includes("timed out")) {
        return {
            statusCode: 504, // Gateway Timeout
            headers,
            body: JSON.stringify({ error: "Le document est trop complexe pour le serveur gratuit. Essayez de couper l'image en deux." })
        };
    }

    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ error: error.message || "Erreur serveur" }) 
    };
  }
};

export { handler };