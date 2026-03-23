import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
   apiKey: "AIzaSyAX7nop2AbcPc9Rbn4nsjHz7OQlwVAPnho",
    authDomain: "deepfake-analyzer.firebaseapp.com",
    projectId: "deepfake-analyzer",
    storageBucket: "deepfake-analyzer.firebasestorage.app",
    messagingSenderId: "35202913586",
    appId: "1:35202913586:web:6e5bfac5dcf24ff5a0732b",
    measurementId: "G-2VGN1ZZJK1"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Force account selection every time so users aren't stuck on a cached account
provider.setCustomParameters({ prompt: "select_account" });

export { onAuthStateChanged };

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    // auth/popup-closed-by-user is not a real error — user just cancelled
    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
      console.log("Sign-in cancelled by user");
      return null;
    }
    console.error("Google sign-in error:", error.code, error.message);
    throw error;
  }
};