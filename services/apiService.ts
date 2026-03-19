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
const MODEL_NAME = "gemini-2.5-flash";

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
        Rôle : Expert Mathématiques & MathML.
        Objectif : Générer un HTML propre contenant du MathML standard.
        
        RÈGLES CRITIQUES (MATHS):
        1. Utilise les balises <math xmlns="http://www.w3.org/1998/Math/MathML" display="block"> pour les équations.
        2. Fractions : <mfrac><mn>num</mn><mn>den</mn></mfrac>
        3. Racines : <mroot>...
        4. Exposants : <msup>...
        5. Systèmes d'équations : Utilise <mrow> et <mo>{</mo> à l'intérieur du MathML.
        
        INTERDIT :
        - Pas de balises <m:oMath> (OMML). Pandoc ne les lit pas.
        - Pas de LaTeX ($...$).
        - Pas d'images pour les maths.
        
        RÈGLES GÉNÉRALES :
        - Le reste du texte en HTML (<h1>, <p>).
        - Toujours garder la police Arial par défaut quelque soit la langue 
        - Respecter les tailles de polices telles qu'apparente sur le scan
        - Respecter les couleurs du texte tel qu'il apparait sur le scan
        - Gère le RTL pour l'arabe.s
        - Ne jamais ajouter de titre au début (trascription de document ou autre...).
        - Ne jamais rien ajouter au manuscrit scanné le documment doit commencer par ce avec quoi le manuscrit commence.
        - Gère le sens d'affichage (tout mettre à gauche pour l'arabe, centrer lorsque le texte apparait centré, et mettre àà gauche lorsque c'est du français / anglais ...etc)
      `;
      userPrompt = "Transcris ce document en HTML + MathML standard, en respectant les polices d'écriture, le style, les couleurs les tailles et tout les éléments visuels àdu manuscrit écrit joint, reproduire fidèlement le manuscrit sans aucun ajout et sans oublier aucun détail ni changer le layout.";
    } else {
      // --- MODE DESIGN (POUR RENDU VISUEL) ---
      systemInstruction = `
        Rôle : Expert OCR & Design HTML.
        Objectif : Reproduire la mise en page à l'identique (Couleurs, Tableaux).
        
        RÈGLES CRITIQUES :
        1. Utilise des TABLEAUX HTML (<table>) pour structurer la page.
        2. Utilise des styles CSS dans <style> pour les couleurs.
        3. Pas de maths complexes, utilise juste du texte.
        4. Gère le RTL pour l'arabe.
      `;
      userPrompt = "Reproduis ce document à l'identique en HTML (Mise en page, couleurs, tableaux)."
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
   * 6. APPEL AU BACKEND RENDER (PANDOC)
   * C'est la fonction qui manquait !
   */
  downloadWordDoc: async (htmlContent: string, fileName: string): Promise<void> => {
    try {
      // Récupération de l'URL Render
      const converterUrl = "https://profscan-render-backend.onrender.com/convert";
      //const converterUrl = import.meta.env.VITE_CONVERTER_URL; <-- je vais remettre ça plutard ça veut juste pas loader 
      
      if (!converterUrl) throw new Error("URL du backend manquante (VITE_CONVERTER_URL)");

      // En-tête HTML minimal pour Pandoc
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="UTF-8"></head>
        <body>${htmlContent}</body>
        </html>
      `;

      const response = await fetch(converterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml })
      });

      if (!response.ok) throw new Error("Erreur conversion serveur");

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
};