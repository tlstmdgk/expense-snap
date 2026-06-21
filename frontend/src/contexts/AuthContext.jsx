import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../services/firebase.js';

const AuthContext = createContext(undefined);

/**
 * Wraps Firebase Authentication state. See spec section 4.1 (users collection)
 * — this context exposes the Firebase Auth user; app-specific profile fields
 * (currency, displayName extras) live in the separate `users/{uid}` Firestore
 * doc and should be fetched alongside this where needed, not duplicated here.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const signup = (email, password) => createUserWithEmailAndPassword(auth, email, password);

  const logout = () => firebaseSignOut(auth);

  const value = { user, loading, login, signup, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
