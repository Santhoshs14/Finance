import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your actual Firebase config from Firebase Console
// Project Settings -> General -> Your apps -> Web app
const firebaseConfig = {
  apiKey: "AIzaSyCn6WXCPt_fWu8OxIph-pEOTsinhzvpOUI",
  authDomain: "finance-tracker-a0d7f.firebaseapp.com",
  projectId: "finance-tracker-a0d7f",
  storageBucket: "finance-tracker-a0d7f.firebasestorage.app",
  messagingSenderId: "201221919167",
  appId: "1:201221919167:web:db7e7778338b151f27110a",
  measurementId: "G-WV77TNTR7R"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
