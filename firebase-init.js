// Firebase setup — handles Google sign-in and cross-device data sync via Firestore.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEmZm81VFNtj36I5nVfQ9V9lPl9IfCoJg",
  authDomain: "logbook-5db91.firebaseapp.com",
  projectId: "logbook-5db91",
  storageBucket: "logbook-5db91.firebasestorage.app",
  messagingSenderId: "49378144607",
  appId: "1:49378144607:web:6c2cb87e338aeda9fd06ea",
  measurementId: "G-77B5JK1BH6",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export function signIn() {
  return signInWithPopup(auth, provider);
}

export function logOut() {
  return signOut(auth);
}

function docRef(uid) {
  return doc(db, "users", uid, "logbook", "data");
}

// Live-subscribes to this user's logbook document. cb receives the stored
// state object (or null if nothing saved yet).
export function subscribeData(uid, cb) {
  return onSnapshot(
    docRef(uid),
    (snap) => cb(snap.exists() ? snap.data().state : null),
    (err) => console.error("sync error", err)
  );
}

export async function pushData(uid, stateObj) {
  await setDoc(docRef(uid), { state: stateObj, updatedAt: Date.now() });
}
