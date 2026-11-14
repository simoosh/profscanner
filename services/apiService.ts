import { db, auth } from '../firebase';
import {
  collection,
  addDoc,
  query,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { encryptText, decryptText, encryptBlob, decryptBlob } from './cryptoService';

// Le modèle utilisé
const MODEL_NAME = "gemini-3.1-pro-preview";

// URL du backend de conversion
const CONVERTER_URL = "https://profscan-cloudcovert-backend.onrender.com/convert";

// ══════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════

export interface ScanResult {
  id: string;
  title: string;
  date: string;
  content: string; // HTML content (déchiffré côté client)
  status: 'completed' | 'processing' | 'failed';
  hasMath?: boolean;
  docxReady?: boolean;         // Le DOCX pré-converti est dispo dans Firestore
  docxIv?: number[];           // IV pour déchiffrement du DOCX
  contentIv?: number[];        // IV pour déchiffrement du HTML
  customizations?: string;     // Instructions de personnalisation
  modificationReport?: string; // Rapport des modifications par l'IA
  pageCount?: number;          // Nombre de pages scannées
}

// ══════════════════════════════════════════
// PROMPTS SYSTÈME (extraits pour lisibilité)
// ══════════════════════════════════════════

const MATH_SYSTEM_PROMPT = `
Rôle : Transcripteur Documentaire Expert et Encodeur MathML W3C.

Objectif : Transcrire fidèlement le contenu d'un manuscrit scanné en HTML sémantique propre, avec un rendu "document tapé à la machine" (police standard, mise en page sobre), tout en encodant rigoureusement les mathématiques en MathML pur pour une conversion automatisée vers Microsoft Word (.docx).

═══════════════════════════════════════════════════
SECTION 1 — STYLE VISUEL (RENDU "DOCUMENT TAPÉ")
═══════════════════════════════════════════════════

1.  POLICE : Utilise UNIQUEMENT des polices de document standard : 'Calibri', 'Arial', 'Times New Roman'. INTERDICTION ABSOLUE d'utiliser des polices manuscrites/cursives (Segoe Print, Comic Sans, Brush Script, etc.). Le but est un document PROPRE et PROFESSIONNEL, PAS une imitation d'écriture.

2.  CSS INLINE UNIQUEMENT : AUCUN bloc <style> global, AUCUN <link> CSS externe. Chaque balise porte son propre attribut style="...".

3.  COULEURS : Reproduis les couleurs des stylos du manuscrit avec des codes HEX (ex: color: #1a237e). Utilise une couleur sombre par défaut (#1a1a2e ou #000000).

4.  SURLIGNAGE : Utilise background-color sur un <span> (ex: <span style="background-color: #FFFF00;">texte</span>).

5.  ENCADRÉS / BOÎTES : Pour tout texte encadré dans le manuscrit, utilise OBLIGATOIREMENT un tableau HTML à une seule cellule :
    <table style="border: 2px solid #000; width: auto; border-collapse: collapse;"><tr><td style="padding: 8px;">Contenu</td></tr></table>
    NE JAMAIS utiliser un <div> avec bordure.

6.  SOULIGNEMENT : Utilise text-decoration: underline sur un <span>.

7.  ALIGNEMENT : Utilise text-align: center / left / right sur les balises de niveau bloc (<p>, <td>).

8.  ANNOTATIONS DE NOTATION (chiffres entourés type "0,25" ou "0,5") : Représente-les comme un simple <sup> après le mot/bloc annoté :
    <sup style="font-size: 8pt; border: 1px solid #333; padding: 0 2px;">(0,25)</sup>
    NE JAMAIS les placer à l'intérieur d'un élément <math>.
    NE JAMAIS utiliser position: absolute/relative pour les positionner.

9.  NUMÉRO DE PAGE (souvent entouré en bas) : Utilise un <p> centré avec un <span> bordé :
    <p style="text-align: center; margin-top: 30px;"><span style="border: 1px solid #333; padding: 3px 10px;">(N)</span></p>

═══════════════════════════════════════════════════
SECTION 2 — CSS INTERDIT (INCOMPATIBLE DOCX)
═══════════════════════════════════════════════════

Les propriétés CSS suivantes CASSENT la conversion vers Word. NE JAMAIS les utiliser :
- display: flex / grid / inline-block
- position: absolute / relative / fixed
- transform (translateX, rotate, etc.)
- overflow-x / overflow-y
- max-width sur le body ou un conteneur racine
- border-radius (ignoré par Word, ne pas s'en servir pour simuler des cercles)
- z-index
- float (sauf cas très simple)

Propriétés CSS AUTORISÉES et bien supportées :
- font-family, font-size (en pt), font-weight, font-style
- color, background-color
- text-align, text-decoration, vertical-align
- margin, padding (en px ou pt)
- border, border-collapse (sur les tables)
- line-height
- width sur les <table> (en % ou auto)

═══════════════════════════════════════════════════
SECTION 3 — STRUCTURE HTML
═══════════════════════════════════════════════════

1.  Commence TOUJOURS par : <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Transcription</title></head><body style="font-family: 'Calibri', 'Arial', sans-serif; margin: 40px; line-height: 1.8; font-size: 12pt;">

2.  Pour les documents en arabe, utilise : <html lang="ar" dir="rtl"> et <body style="font-family: 'Calibri', 'Arial', sans-serif; margin: 40px; line-height: 1.8; font-size: 12pt; direction: rtl; text-align: right;">

3.  Utilise des balises sémantiques de niveau bloc : <p>, <h1>-<h6>, <table>, <ul>, <ol>.

4.  NE PAS imbriquer des <div> complexes. Préfère des <p> successifs.

5.  NE PAS envelopper tout le contenu dans un <div> racine avec du style complexe.

═══════════════════════════════════════════════════
SECTION 4 — MATHML (CRITIQUE — LIRE ATTENTIVEMENT)
═══════════════════════════════════════════════════

Le HTML sera traité par un backend qui EXTRAIT les balises <math>, les convertit en OMML (format Word natif) via la bibliothèque mathml2omml, puis les réinjecte dans le .docx. Toute erreur dans le MathML provoquera un fichier Word CORROMPU.

QUAND UTILISER <math> :
- Formules et équations (ex: E = mc², a² + b² = c²)
- Fractions écrites avec barre (ex: 1/2 écrit comme fraction)
- Variables dans un CONTEXTE MATHÉMATIQUE (ex: "soit x tel que f(x) = 0")
- Symboles mathématiques spéciaux (∑, ∫, ∏, →, ⇒, ∞)
- Indices/exposants mathématiques (ex: a₀, x², nₖ)
- Systèmes d'équations
- Toute expression avec des opérateurs mathématiques

QUAND NE PAS UTILISER <math> (ÉCRIRE EN TEXTE BRUT) :
- Nombres simples dans du texte courant (ex: "il y a 5 boules", "les chiffres 1, 2, 3")
- Lettres-labels ou abréviations (ex: "événement A", "point B", "catégorie C")
- Numéros d'exercices (ex: "Exercice 03", "Question 2")
- Unités de mesure seules (ex: "cm", "kg", "mol/L")
- Chiffres d'énumération (ex: "1 -", "2 -", "a)", "b)")
- Dates, numéros de page, numéros de téléphone
- Texte ordinaire qui contient des lettres isolées (ex: "le point A", "la droite d")

⚠️ RÈGLE D'OR : Si un nombre ou une lettre apparaît dans une PHRASE TEXTUELLE sans
   relation mathématique (pas d'opérateur, pas de formule, pas de variable dans une
   équation), il NE DOIT PAS être dans <math>. Seules les expressions qui seraient
   affichées avec un éditeur d'équations dans Word doivent être en <math>.

RÈGLES ABSOLUES :

A) Pour les expressions mathématiques qualifiées (voir ci-dessus), utiliser :
   <math xmlns="http://www.w3.org/1998/Math/MathML">...</math>

B) Pour une équation sur sa propre ligne (centrée), ajouter display="block" :
   <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">...</math>

C) INTERDICTION FORMELLE de mettre un attribut style="..." sur TOUTE balise MathML :
   ❌ INTERDIT : <math style="margin: 5px;">
   ❌ INTERDIT : <mtext style="border: 1px solid #000;">
   ❌ INTERDIT : <mtable style="border-spacing: 10px;">
   ❌ INTERDIT : <mspace width="25px"/>  (pas de px !)
   ✅ CORRECT  : <math xmlns="http://www.w3.org/1998/Math/MathML">
   ✅ CORRECT  : <mspace width="1em"/>  (utiliser em uniquement)

D) NE JAMAIS placer de balises HTML à l'intérieur de <math> :
   ❌ INTERDIT : <math><span>texte</span></math>
   ❌ INTERDIT : <math><div>...</div></math>

E) Balises MathML autorisées (liste exhaustive) :
   <mi> (identifiant/variable), <mn> (nombre), <mo> (opérateur),
   <mtext> (texte dans les maths, SANS attribut style),
   <mrow> (groupement), <mfrac> (fraction),
   <msup> (exposant), <msub> (indice), <msubsup> (indice+exposant),
   <msqrt> (racine carrée), <mroot> (racine n-ième),
   <mover> (accent au-dessus), <munder> (accent en-dessous),
   <mtable> (tableau math), <mtr> (ligne), <mtd> (cellule),
   <mspace> (espacement, width en "em" uniquement),
   <mfenced> (délimiteurs)

F) FRACTIONS : Toujours <mfrac><mrow>numérateur</mrow><mrow>dénominateur</mrow></mfrac>.
   NE JAMAIS utiliser le caractère slash "/".

G) SYSTÈMES D'ÉQUATIONS avec accolade :
   <math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
     <mrow>
       <mo>{</mo>
       <mtable columnalign="left">
         <mtr><mtd><mrow>...</mrow></mtd></mtr>
         <mtr><mtd><mrow>...</mrow></mtd></mtr>
       </mtable>
     </mrow>
   </math>
   L'attribut columnalign="left" est le SEUL attribut non-standard autorisé sur <mtable>.

H) INTERDICTION de LaTeX ($...$), AsciiMath, ou images pour les maths.

═══════════════════════════════════════════════════
SECTION 5 — LANGUES RTL (ARABE)
═══════════════════════════════════════════════════

1.  Si le document est en arabe, utiliser <html lang="ar" dir="rtl"> et appliquer dir="rtl" ET style="text-align: right;" sur le <body> et les <p>.
2.  Le texte arabe doit être écrit normalement. Le navigateur et Word gèrent la direction RTL.
3.  Isoler les passages en français/anglais dans un <span dir="ltr"> pour éviter l'inversion.
4.  Envelopper tout <math> inline dans du texte arabe avec <span dir="ltr"><math>...</math></span>.
5.  Les nombres dans les énoncés arabes restent en texte brut, PAS en <math>.

═══════════════════════════════════════════════════
SECTION 6 — NETTOYAGE
═══════════════════════════════════════════════════

1.  NE PAS transcrire les ratures/mots barrés. Garder UNIQUEMENT la version finale.
2.  NE PAS générer de texte d'introduction ("Voici la transcription :").
3.  Renvoyer UNIQUEMENT le code HTML brut, sans blocs markdown (pas de html).
4.  Si le document est totalement illisible, renvoyer : ERROR_UNREADABLE`;

const DESIGN_SYSTEM_PROMPT = MATH_SYSTEM_PROMPT; // Même prompt pour les deux modes

const USER_PROMPT_BASE = "Transcris ce manuscrit en HTML sémantique propre avec MathML W3C standard. Le résultat doit ressembler à un document tapé à la machine (police Calibri, mise en page sobre et professionnelle), PAS à une imitation de l'écriture manuscrite. Préserve fidèlement : le contenu textuel, la disposition/layout, les couleurs des stylos, les soulignements, les encadrés, les annotations de notation (chiffres entourés), et toutes les équations mathématiques.  IMPORTANT : utilise <math> UNIQUEMENT pour les vraies expressions mathématiques (formules, équations, fractions, variables dans un contexte d'équation). Les nombres simples dans le texte (ex: '5 boules', 'chiffre 3'), les lettres-labels (ex: 'événement A', 'point B'), et les numéros d'exercice (ex: 'EX 03') doivent rester en TEXTE BRUT, PAS en <math>. N'ajoute rien, n'oublie rien.";

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

/** Convertit un File en base64 (sans le préfixe data:...) */
const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve({
        data: result.split(',')[1],
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.onerror = reject;
  });
};

/** Suggère un titre à partir du contenu HTML */
const suggestTitle = (html: string): string => {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const textContent = tempDiv.textContent || "";
  return textContent.split(/\s+/).slice(0, 5).join(" ").substring(0, 30) + "...";
};

/** Déclenche le téléchargement d'un Blob */
const triggerDownload = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

// ══════════════════════════════════════════
// SERVICE PRINCIPAL
// ══════════════════════════════════════════

export const ApiService = {

  /**
   * SCAN MULTI-PAGES (1 à 15 images)
   * Traite toutes les images en une seule requête Gemini.
   * Si des instructions de personnalisation sont fournies, elles sont ajoutées au prompt système.
   * Le DOCX est pré-converti et stocké dans Firestore en arrière-plan.
   */
  uploadMultipleDocuments: async (
    files: File[],
    hasMath: boolean,
    customPrompt: string = ""
  ): Promise<ScanResult> => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Clé API manquante.");

      // 1. Convertir tous les fichiers en base64
      const base64Files = await Promise.all(files.map(f => fileToBase64(f)));

      // 2. Construire le prompt système avec les instructions custom
      let systemInstruction = hasMath ? MATH_SYSTEM_PROMPT : DESIGN_SYSTEM_PROMPT;

      // Section rapport de modifications si personnalisation demandée
      if (customPrompt.trim()) {
        systemInstruction += `

═══════════════════════════════════════════════════
SECTION 7 — INSTRUCTIONS SUPPLÉMENTAIRES DE L'UTILISATEUR
═══════════════════════════════════════════════════

L'utilisateur a demandé les modifications suivantes. Applique-les AU CONTENU TRANSCRIT, 
puis génère un RAPPORT DE MODIFICATIONS à la fin du HTML.

Instructions :
${customPrompt}

RAPPORT DE MODIFICATIONS :
Après le contenu HTML principal, ajoute un bloc séparé avec le format EXACT suivant :

<!-- MODIFICATION_REPORT_START -->
<div id="modification-report" style="margin-top: 40px; padding: 20px; border-top: 3px solid #3b82f6; font-family: 'Calibri', sans-serif;">
  <h2 style="color: #1e40af; font-size: 14pt; margin-bottom: 15px;">Rapport des Modifications</h2>
  <ul style="font-size: 11pt; line-height: 1.8; color: #374151;">
    <li><strong>Type :</strong> [description de la modification]</li>
    <li><strong>Détails :</strong> [liste précise des changements effectués]</li>
  </ul>
</div>
<!-- MODIFICATION_REPORT_END -->

Le rapport doit lister CHAQUE modification apportée de manière précise et factuelle.
Par exemple : "Correction orthographique : 'algorythme' → 'algorithme' (ligne 3)".`;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        systemInstruction: systemInstruction,
      });

      // 3. Construire le contenu multi-image
      const userPrompt = files.length > 1
        ? `Transcris ces ${files.length} pages de manuscrit en UN SEUL document HTML continu. ${USER_PROMPT_BASE}`
        : USER_PROMPT_BASE;

      const contentParts: any[] = [
        ...base64Files.map((b64) => ({
          inlineData: { data: b64.data, mimeType: b64.mimeType },
        })),
        userPrompt,
      ];

      const result = await model.generateContent(contentParts);
      let cleanHtml = result.response.text().replace(/```html/g, '').replace(/```/g, '').trim();

      if (cleanHtml === "ERROR_UNREADABLE") throw new Error("Image illisible.");

      // 4. Extraire le rapport de modifications s'il existe, puis le RETIRER du HTML
      //    Le rapport ne doit PAS apparaître dans le DOCX — il est affiché uniquement dans Result.tsx
      let modificationReport: string | undefined;
      const reportMatch = cleanHtml.match(
        /<!-- MODIFICATION_REPORT_START -->([\s\S]*?)<!-- MODIFICATION_REPORT_END -->/
      );
      if (reportMatch) {
        modificationReport = reportMatch[1].trim();
        // Retirer le bloc rapport du HTML pour que le DOCX soit propre
        cleanHtml = cleanHtml.replace(
          /<!-- MODIFICATION_REPORT_START -->[\s\S]*?<!-- MODIFICATION_REPORT_END -->/,
          ''
        ).trim();
      }

      // 5. Titre auto
      const suggestedTitle = suggestTitle(cleanHtml);

      // 6. Préparer le scan
      const newScan: ScanResult = {
        id: `temp-${Date.now()}`,
        title: suggestedTitle || files[0].name.split('.')[0],
        date: new Date().toISOString(),
        content: cleanHtml, // HTML SANS le rapport
        status: 'completed',
        hasMath: hasMath,
        docxReady: false,
        customizations: customPrompt.trim() || undefined,
        modificationReport: modificationReport,
        pageCount: files.length,
      };

      // 7. Sauvegarde Cloud (Firebase) avec chiffrement
      const user = auth.currentUser;
      const shouldSave = localStorage.getItem('saveHistory') !== 'false';

      if (user && shouldSave) {
        try {
          // Chiffrer le contenu HTML (sans le rapport)
          const { encryptedBase64: encContent, iv: contentIv } = await encryptText(cleanHtml, user.uid);

          // Chiffrer le rapport si présent (stocké séparément)
          let encReport: string | undefined;
          let reportIv: number[] | undefined;
          if (modificationReport) {
            const reportEncrypted = await encryptText(modificationReport, user.uid);
            encReport = reportEncrypted.encryptedBase64;
            reportIv = reportEncrypted.iv;
          }

          const docRef = await addDoc(collection(db, 'users', user.uid, 'scans'), {
            title: newScan.title,
            date: newScan.date,
            content: encContent,        // HTML chiffré (SANS rapport)
            contentIv: contentIv,        // IV pour déchiffrer le HTML
            status: 'completed',
            hasMath: hasMath,
            docxReady: false,
            customizations: newScan.customizations,
            modificationReport: encReport,       // Rapport chiffré (séparé)
            modificationReportIv: reportIv,      // IV du rapport
            pageCount: files.length,
            encrypted: true,  // Flag pour savoir que ce doc est chiffré
          });
          newScan.id = docRef.id;

          // 8. Lancer la pré-conversion DOCX en arrière-plan (avec HTML sans rapport)
          ApiService.preConvertAndStore(docRef.id, cleanHtml, newScan.title, user.uid).catch(
            (e) => console.warn('Pre-conversion en arrière-plan échouée:', e)
          );
        } catch (e) {
          console.error("Erreur sauvegarde Firebase:", e);
        }
      }

      return newScan;

    } catch (error: any) {
      console.error("Erreur Upload Multi:", error);
      throw error;
    }
  },

  /**
   * PRÉ-CONVERSION DOCX (fire-and-forget)
   * Appelle le backend Render, récupère le DOCX, le chiffre, 
   * et le stocke en base64 dans Firestore.
   */
  preConvertAndStore: async (
    scanId: string,
    htmlContent: string,
    _fileName: string,
    uid: string
  ): Promise<void> => {
    try {
      // 1. Préparer le HTML complet
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="fr" dir="auto">
        <head>
          <meta charset="UTF-8">
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      // 2. Appeler le backend de conversion
      const response = await fetch(CONVERTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Conversion failed (${response.status}): ${errorText}`);
      }

      // 3. Récupérer le blob DOCX
      const blob = await response.blob();

      // 4. Chiffrer le DOCX
      const { encryptedBase64, iv } = await encryptBlob(blob, uid);

      // 5. Stocker dans Firestore (base64 chiffré)
      // Note: Firestore limite à 1 MB par document.
      // Le DOCX chiffré en base64 est ~33% plus gros que le binaire.
      // Pour la plupart des documents de quelques pages, ça reste sous 1 MB.
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(doc(db, 'users', user.uid, 'scans', scanId), {
        docxReady: true,
        docxData: encryptedBase64,   // DOCX chiffré en base64
        docxIv: iv,                  // IV pour déchiffrement
      });

      console.log(`✅ DOCX pré-converti et stocké pour scan ${scanId}`);

    } catch (e) {
      console.error('Erreur pré-conversion DOCX:', e);
      // On ne propage pas l'erreur — le fallback existe dans downloadWordDoc
    }
  },

  /**
   * TÉLÉCHARGEMENT DOCX
   * Fast-path : récupère le DOCX pré-converti depuis Firestore
   * Fallback : conversion à la demande via le backend Render
   */
  downloadWordDoc: async (
    scanId: string,
    htmlContent: string,
    fileName: string
  ): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Non connecté');

    try {
      // 1. Vérifier si le DOCX pré-converti existe
      if (!scanId.startsWith('temp-')) {
        const scanDoc = await getDoc(doc(db, 'users', user.uid, 'scans', scanId));
        const data = scanDoc.data();

        if (data?.docxReady && data?.docxData) {
          // FAST PATH — Téléchargement instantané depuis Firestore
          console.log('⚡ Fast path : DOCX pré-converti trouvé');

          const iv = data.docxIv as number[];
          const decryptedBlob = await decryptBlob(data.docxData, iv, user.uid);
          triggerDownload(decryptedBlob, fileName);
          return;
        }
      }

      // 2. FALLBACK — Conversion à la demande
      console.log('🔄 Fallback : conversion à la demande');

      const fullHtml = `
        <!DOCTYPE html>
        <html lang="fr" dir="auto">
        <head><meta charset="UTF-8"></head>
        <body>${htmlContent}</body>
        </html>
      `;

      const response = await fetch(CONVERTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
      }

      const blob = await response.blob();
      triggerDownload(blob, fileName);

    } catch (error) {
      console.error("Erreur téléchargement:", error);
      throw error;
    }
  },

  /**
   * LEGACY : Upload single document (redirige vers uploadMultipleDocuments)
   */
  uploadDocument: async (file: File, hasMath: boolean): Promise<ScanResult> => {
    return ApiService.uploadMultipleDocuments([file], hasMath, "");
  },

  /**
   * RÉCUPÉRER L'HISTORIQUE (avec déchiffrement)
   */
  getHistory: async (): Promise<ScanResult[]> => {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      const q = query(collection(db, 'users', user.uid, 'scans'));
      const querySnapshot = await getDocs(q);
      const history: ScanResult[] = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();

        let content = data.content;
        let modReport = data.modificationReport;

        // Déchiffrer si le doc est chiffré
        if (data.encrypted && data.contentIv) {
          try {
            content = await decryptText(data.content, data.contentIv, user.uid);
          } catch (e) {
            console.error(`Erreur déchiffrement scan ${docSnap.id}:`, e);
            content = '<p style="color:red;">Erreur de déchiffrement</p>';
          }
        }

        if (data.modificationReport && data.modificationReportIv) {
          try {
            modReport = await decryptText(data.modificationReport, data.modificationReportIv, user.uid);
          } catch (e) {
            console.error(`Erreur déchiffrement rapport ${docSnap.id}:`, e);
          }
        }

        history.push({
          id: docSnap.id,
          title: data.title || 'Sans titre',
          date: data.date,
          content: content,
          status: 'completed',
          hasMath: data.hasMath,
          docxReady: data.docxReady || false,
          docxIv: data.docxIv,
          contentIv: data.contentIv,
          customizations: data.customizations,
          modificationReport: modReport,
          pageCount: data.pageCount,
        });
      }
      return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error("Erreur historique:", error);
      return [];
    }
  },

  /**
   * RÉCUPÉRER UN SCAN PRÉCIS (avec déchiffrement)
   */
  getScanById: async (id: string): Promise<ScanResult | undefined> => {
    const user = auth.currentUser;
    if (!user || id.startsWith('temp-')) return undefined;
    try {
      const docRef = doc(db, 'users', user.uid, 'scans', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        let content = data.content;
        let modReport = data.modificationReport;

        if (data.encrypted && data.contentIv) {
          try {
            content = await decryptText(data.content, data.contentIv, user.uid);
          } catch (e) {
            console.error(`Erreur déchiffrement:`, e);
            content = '<p style="color:red;">Erreur de déchiffrement</p>';
          }
        }

        if (data.modificationReport && data.modificationReportIv) {
          try {
            modReport = await decryptText(data.modificationReport, data.modificationReportIv, user.uid);
          } catch (e) {
            console.error(`Erreur déchiffrement rapport:`, e);
          }
        }

        return {
          id: docSnap.id,
          title: data.title,
          date: data.date,
          content: content,
          status: 'completed',
          hasMath: data.hasMath,
          docxReady: data.docxReady || false,
          docxIv: data.docxIv,
          contentIv: data.contentIv,
          customizations: data.customizations,
          modificationReport: modReport,
          pageCount: data.pageCount,
        };
      }
    } catch (error) {
      console.error(error);
    }
    return undefined;
  },

  updateScanTitle: async (id: string, newTitle: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'scans', id);
      await updateDoc(docRef, { title: newTitle });
    } catch (error) {
      throw error;
    }
  },

  deleteScan: async (id: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'scans', id);
      await deleteDoc(docRef);
    } catch (error) {
      throw error;
    }
  },
};