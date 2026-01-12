import { db, auth } from '../firebaseConfig';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  orderBy, 
  updateDoc
} from 'firebase/firestore';

export interface ScanResult {
  id: string;
  title: string;
  date: string;
  content: string;
  status: 'completed' | 'processing' | 'failed';
}

export const ApiService = {
  /**
   * 1. SCAN + SAUVEGARDE
   */
  uploadDocument: async (file: File): Promise<ScanResult> => {
    try {
      // A. Conversion Image -> Base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });

      // B. Appel à l'IA (Ton Backend Netlify)
      const response = await fetch('/.netlify/functions/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });

      if (!response.ok) throw new Error("Erreur de connexion au serveur IA");
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.html === "ERROR_UNREADABLE") throw new Error("Image illisible.");

      // C. Création de l'objet résultat
      const newScan: ScanResult = {
        id: `temp-${Date.now()}`, // ID temporaire avant sauvegarde
        title: file.name.split('.')[0] || 'Nouveau Scan',
        date: new Date().toISOString(),
        content: data.html,
        status: 'completed'
      };

      // D. SAUVEGARDE CLOUD (Si l'utilisateur est connecté ET a activé l'option)
      const user = auth.currentUser;
      const shouldSave = localStorage.getItem('saveHistory') !== 'false'; // Par défaut true

      if (user && shouldSave) {
        try {
          // On écrit dans la collection : users / [UID] / scans
          const docRef = await addDoc(collection(db, 'users', user.uid, 'scans'), {
            title: newScan.title,
            date: newScan.date,
            content: newScan.content,
            status: 'completed'
          });
          newScan.id = docRef.id; // On remplace l'ID temporaire par le vrai ID Firebase
          console.log("Scan sauvegardé sur le Cloud ✅");
        } catch (e) {
          console.error("Erreur sauvegarde Cloud (Scan affiché mais non enregistré):", e);
        }
      }

      return newScan;

    } catch (error: any) {
      console.error("Erreur Upload:", error);
      throw error;
    }
  },

  /**
   * 2. RÉCUPÉRER L'HISTORIQUE (Depuis Firebase)
   */
  getHistory: async (): Promise<ScanResult[]> => {
    const user = auth.currentUser;
    if (!user) return []; // Si pas connecté, pas d'historique

    try {
      // Requête : Dans le dossier de l'user, prends la collection 'scans', triée par date
      // Note: Le tri 'orderBy' peut nécessiter la création d'un index dans la console Firebase (voir logs)
      // Pour l'instant on fait simple sans orderBy pour éviter l'erreur d'index au début
      const q = query(
        collection(db, 'users', user.uid, 'scans')
      );

      const querySnapshot = await getDocs(q);
      const history: ScanResult[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        history.push({
          id: doc.id,
          title: data.title || 'Sans titre',
          date: data.date,
          content: data.content,
          status: 'completed'
        });
      });

      // Tri manuel côté client (plus simple pour démarrer sans configurer les Index)
      return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    } catch (error) {
      console.error("Erreur chargement historique:", error);
      return [];
    }
  },

  /**
   * 3. RÉCUPÉRER UN SCAN PRÉCIS
   */
  getScanById: async (id: string): Promise<ScanResult | undefined> => {
    const user = auth.currentUser;
    // Si l'ID est temporaire (scan non sauvegardé venant de d'être fait), on ne peut pas le recharger depuis la BDD
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
          status: 'completed'
        };
      }
    } catch (error) {
      console.error("Erreur chargement scan:", error);
    }
    return undefined;
  },

  /**
   * 4. METTRE À JOUR LE TITRE
   */
   updateScanTitle: async (id: string, newTitle: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, 'users', user.uid, 'scans', id);
      await updateDoc(docRef, {
        title: newTitle
      });
    } catch (error) {
      console.error("Erreur renommage:", error);
      throw error;
    }
  }
};
