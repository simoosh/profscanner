import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace with actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsX30vKYht7QWGqtXAmV9zJQJCSlM5t3s",
  authDomain: "profocr-8cc1f.firebaseapp.com",
  projectId: "profocr-8cc1f",
  storageBucket: "profocr-8cc1f.firebasestorage.app",
  messagingSenderId: "309575063386",
  appId: "1:309575063386:web:8b2e35d10556914fbb0563",
  measurementId: "G-50JXMSE19B"
};

// Initialize Firebase (wrapped in try-catch to prevent crash if config is invalid during dev)
let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.warn("Firebase initialization failed. Using mock mode.", error);
}

export { auth, db };
