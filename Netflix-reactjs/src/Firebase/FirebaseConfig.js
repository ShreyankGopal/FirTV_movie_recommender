import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";  // Add this import

const firebaseConfig = {
  apiKey: "AIzaSyD3Vwu4efdzerOSEtpmD5Rv0xPJH3Cc7F8",
  authDomain: "firetvrecommender.firebaseapp.com",
  projectId: "firetvrecommender",
  storageBucket: "firetvrecommender.firebasestorage.app",
  messagingSenderId: "396599965819",
  appId: "1:396599965819:web:213557f0e6dcd573168ade",
  measurementId: "G-CNTBKR8TFZ"
};

// Initialize Firebase
const FirebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(FirebaseApp);  // Initialize auth
export const db = getFirestore(FirebaseApp);
const analytics = getAnalytics(FirebaseApp);

export default FirebaseApp;