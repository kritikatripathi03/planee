/**
 * Planee — Firebase Configuration
 * Initialises Firebase App, Firestore, and Authentication.
 */

const firebaseConfig = {
  apiKey:            "AIzaSyB3Bstij8H0DbCqOQKLZXuW_1qElqWwpuQ",
  authDomain:        "planee-b3710.firebaseapp.com",
  projectId:         "planee-b3710",
  storageBucket:     "planee-b3710.firebasestorage.app",
  messagingSenderId: "250048715933",
  appId:             "1:250048715933:web:e4b4be7959ef9ccbfa4874"
};

firebase.initializeApp(firebaseConfig);

// Expose globally
window.firestoreDb   = firebase.firestore();
window.firebaseAuth  = firebase.auth();
window.googleProvider = new firebase.auth.GoogleAuthProvider();
