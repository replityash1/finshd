/**
 * js/firebase-config.js — Firebase initialization
 */

const firebaseConfig = {
  apiKey: "AIzaSyDQi2ObF4D64AiKgGCgCjxA4mglGFjz_q0",
  authDomain: "syllabus-tracker-a6194.firebaseapp.com",
  projectId: "syllabus-tracker-a6194",
  storageBucket: "syllabus-tracker-a6194.firebasestorage.app",
  messagingSenderId: "913425135048",
  appId: "1:913425135048:web:cd5b364869a02fdaa03cfd"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Global references
const firebaseAuth = firebase.auth();
const firebaseDb   = firebase.firestore();

// Google Auth provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
