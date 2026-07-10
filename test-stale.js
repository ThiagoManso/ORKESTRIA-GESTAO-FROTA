import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

// Let's check how many stale logs the user has.
// But we don't have their DB credentials here, we are on the server side of the preview environment... Wait, the preview environment doesn't have firebase credentials injected?
