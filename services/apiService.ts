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

// Le modèle utilisé
const MODEL_NAME = "gemini-3.1-pro-preview";

export interface ScanResult {
  id: string;
  title: string;
  date: string;
  content: string;
  status: 'completed' | 'processing' | 'failed';
  hasMath?: boolean; // Booléen important pour le choix du téléchargement
}

export const ApiService = {
  /**
   * 1. SCAN DIRECT (Client-Side)
   */
  uploadDocument: async (file: File, hasMath: boolean): Promise<ScanResult> => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Clé API manquante.");

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });

      const genAI = new GoogleGenerativeAI(apiKey);
      
      // --- CHOIX DU PROMPT ---
      let systemInstruction = "";
      let userPrompt = "";

      if (hasMath) {
        // MODE MATHS (Word XML/OMML)
        systemInstruction = `
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
      
      userPrompt = "Transcris ce manuscrit en HTML sémantique propre avec MathML W3C standard. Le résultat doit ressembler à un document tapé à la machine (police Calibri, mise en page sobre et professionnelle), PAS à une imitation de l'écriture manuscrite. Préserve fidèlement : le contenu textuel, la disposition/layout, les couleurs des stylos, les soulignements, les encadrés, les annotations de notation (chiffres entourés), et toutes les équations mathématiques.  IMPORTANT : utilise <math> UNIQUEMENT pour les vraies expressions mathématiques (formules, équations, fractions, variables dans un contexte d'équation). Les nombres simples dans le texte (ex: '5 boules', 'chiffre 3'), les lettres-labels (ex: 'événement A', 'point B'), et les numéros dexercice (ex: 'EX 03') doivent rester en TEXTE BRUT, PAS en <math>. N'ajoute rien, n'oublie rien.";
    } else {
      // --- MODE DESIGN (POUR RENDU VISUEL) ---
      systemInstruction = `
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
      4.  Si le document est totalement illisible, renvoyer : ERROR_UNREADABLE
      `;
      userPrompt = "Transcris ce manuscrit en HTML sémantique propre avec MathML W3C standard. Le résultat doit ressembler à un document tapé à la machine (police Calibri, mise en page sobre et professionnelle), PAS à une imitation de l'écriture manuscrite. Préserve fidèlement : le contenu textuel, la disposition/layout, les couleurs des stylos, les soulignements, les encadrés, les annotations de notation (chiffres entourés), et toutes les équations mathématiques.  IMPORTANT : utilise <math> UNIQUEMENT pour les vraies expressions mathématiques (formules, équations, fractions, variables dans un contexte d'équation). Les nombres simples dans le texte (ex: '5 boules', 'chiffre 3'), les lettres-labels (ex: 'événement A', 'point B'), et les numéros dexercice (ex: 'EX 03') doivent rester en TEXTE BRUT, PAS en <math>. N'ajoute rien, n'oublie rien."
      }

      const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        systemInstruction: systemInstruction
      });

      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType: file.type } },
        userPrompt
      ]);

      const cleanHtml = result.response.text().replace(/```html/g, '').replace(/```/g, '').trim();

      if (cleanHtml === "ERROR_UNREADABLE") throw new Error("Image illisible.");

      // Titre auto
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = cleanHtml;
      const textContent = tempDiv.textContent || "";
      const suggestedTitle = textContent.split(/\s+/).slice(0, 5).join(" ").substring(0, 30) + "...";

      const newScan: ScanResult = {
        id: `temp-${Date.now()}`,
        title: suggestedTitle || (file.name.split('.')[0]),
        date: new Date().toISOString(),
        content: cleanHtml,
        status: 'completed',
        hasMath: hasMath // On garde l'info en mémoire locale
      };

      // Sauvegarde Cloud (Firebase)
      const user = auth.currentUser;
      const shouldSave = localStorage.getItem('saveHistory') !== 'false';

      if (user && shouldSave) {
        try {
          const docRef = await addDoc(collection(db, 'users', user.uid, 'scans'), {
            title: newScan.title,
            date: newScan.date,
            content: newScan.content,
            status: 'completed',
            hasMath: hasMath // <--- IMPORTANT : ON SAUVEGARDE L'OPTION DANS LA BDD
          });
          newScan.id = docRef.id;
        } catch (e) { console.error(e); }
      }

      return newScan;

    } catch (error: any) {
      console.error("Erreur Upload:", error);
      throw error;
    }
  },

  /**
   * 2. RÉCUPÉRER L'HISTORIQUE
   */
  getHistory: async (): Promise<ScanResult[]> => {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      const q = query(collection(db, 'users', user.uid, 'scans'));
      const querySnapshot = await getDocs(q);
      const history: ScanResult[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        history.push({
          id: doc.id,
          title: data.title || 'Sans titre',
          date: data.date,
          content: data.content,
          status: 'completed',
          hasMath: data.hasMath // <--- IMPORTANT : ON RÉCUPÈRE L'OPTION
        });
      });
      return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) { console.error("Erreur historique:", error); return []; }
  },

  /**
   * 3. RÉCUPÉRER UN SCAN PRÉCIS
   */
  getScanById: async (id: string): Promise<ScanResult | undefined> => {
    const user = auth.currentUser;
    if (!user || id.startsWith('temp-')) return undefined;
    try {
      const docRef = doc(db, 'users', user.uid, 'scans', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.title,
          date: data.date,
          content: data.content,
          status: 'completed',
          hasMath: data.hasMath // <--- IMPORTANT : ON RÉCUPÈRE L'OPTION ICI AUSSI
        };
      }
    } catch (error) { console.error(error); }
    return undefined;
  },

  updateScanTitle: async (id: string, newTitle: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'scans', id);
      await updateDoc(docRef, { title: newTitle });
    } catch (error) { throw error; }
  },

  deleteScan: async (id: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'scans', id);
      await deleteDoc(docRef);
    } catch (error) { throw error; }
  },

  /**
   * 6. APPEL AU NOUVEAU BACKEND RENDER (CloudConvert + OMML Patcher)
   */
  downloadWordDoc: async (htmlContent: string, fileName: string): Promise<void> => {
    try {
      // Remplace cette URL par celle de ton nouveau backend hébergé sur Render
      // Assure-toi de bien garder /convert à la fin
      const converterUrl = "https://profscan-cloudcovert-backend.onrender.com/convert";
      
      // On prépare un HTML propre pour CloudConvert
      // IMPORTANT : On s'assure d'inclure le charset UTF-8 pour ne pas casser l'arabe
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

      const response = await fetch(converterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml })
      });

      if (!response.ok) {
         // Tentative de récupération du message d'erreur du backend
         const errorText = await response.text();
         throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error("Erreur Render:", error);
      throw error;
    }
  }
}