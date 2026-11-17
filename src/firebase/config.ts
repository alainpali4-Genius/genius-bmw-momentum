'use client';

/**
 * Configuración pública de Firebase para Genius BMW.
 *
 * Los valores NEXT_PUBLIC_* de Vercel tienen prioridad. Los valores de
 * respaldo permiten que los previews funcionen aunque esas variables aún
 * no estén configuradas en el entorno de despliegue.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDWTLt4ibj9HOWG5ydFlbGsEv2RESHLdgA",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-2945617937-c946d.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-2945617937-c946d",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-2945617937-c946d.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "545767707872",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:545767707872:web:b4c26c8c70b577b5586c85",
};
