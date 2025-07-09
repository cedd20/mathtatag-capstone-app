import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// TODO: Replace with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyAZWbRzY6L0M-3biNEx6iNnStlW0LwJTeI",
  authDomain: "mathtatag-2025.firebaseapp.com",
  projectId: "mathtatag-2025",
  storageBucket: "mathtatag-2025.appspot.com",
  messagingSenderId: "760754624848",
  appId: "1:760754624848:web:e9ccbc079c912e5de5f455",
  measurementId: "G-TN0JLXZ4SW"
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
const auth = getAuth(app);

export const db = getDatabase(app);

export { auth };

