import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCsX30vKYht7QWGqtXAmV9zJQJCSlM5t3s", // Tes clés sont ici
  authDomain: "profocr-8cc1f.firebaseapp.com",
  projectId: "profocr-8cc1f",
  storageBucket: "profocr-8cc1f.appspot.com",
  messagingSenderId: "309575063386",
  appId: "1:309575063386:web:8b2e35d10556914fbb0563",
};

const app: FirebaseApp = initializeApp(firebaseConfig);

// On exporte 'auth' et 'db' avec leurs types
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);