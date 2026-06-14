import { initializeApp } from "firebase/app";

import {
  getDatabase
} from "firebase/database";

const firebaseConfig = {

  apiKey:
    "AIzaSyBzGM7ugM4WVLYbaoZ7e7PcyKpSSJhRWgo",

  authDomain:
    "livetrackingapp-74378.firebaseapp.com",

  databaseURL:
    "https://livetrackingapp-74378-default-rtdb.firebaseio.com",

  projectId:
    "livetrackingapp-74378",

  storageBucket:
    "livetrackingapp-74378.firebasestorage.app",

  messagingSenderId:
    "671951221002",

  appId:
    "1:671951221002:web:523b74dd8f85ec43a54af3",
};

const app =
  initializeApp(firebaseConfig);

export const db =
  getDatabase(app);