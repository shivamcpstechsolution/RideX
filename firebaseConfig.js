import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth, inMemoryPersistence, browserSessionPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyBzGM7ugM4WVLYbaoZ7e7PcyKpSSJhRWgo",
  authDomain: "livetrackingapp-74378.firebaseapp.com",
  databaseURL: "https://livetrackingapp-74378-default-rtdb.firebaseio.com",
  projectId: "livetrackingapp-74378",
  storageBucket: "livetrackingapp-74378.firebasestorage.app",
  messagingSenderId: "671951221002",
  appId: "1:671951221002:web:523b74dd8f85ec43a54af3",
};

const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with platform-appropriate settings
export const auth = Platform.OS === "web"
  ? (() => {
      const a = getAuth(app);
      return a;
    })()
  : initializeAuth(app, {
      persistence: inMemoryPersistence,
    });

export const db = getDatabase(app);

// Set session persistence for security
if (Platform.OS === "web") {
  import("firebase/auth").then(({ setPersistence, browserSessionPersistence }) => {
    setPersistence(auth, browserSessionPersistence).catch((error) => {
      console.warn("Auth persistence error:", error.message);
    });
  });
}