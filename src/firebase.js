import {initializeApp} from "firebase/app" ;
import {getFirestore} from "firebase/firestore";
import {getStorage} from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyCZh-Ed9DfZUIAk-q3c8LEz6_pYWpoBFw0",
  authDomain: "enhancedprotections.firebaseapp.com",
  projectId: "enhancedprotections",
  storageBucket: "enhancedprotections.firebasestorage.app",
  messagingSenderId: "214626242061",
  appId: "1:214626242061:web:1a6daa2b4b7ef605f0cf44",
  measurementId: "G-07LHJ4183T"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
