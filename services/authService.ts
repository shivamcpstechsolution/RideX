import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    User
} from "firebase/auth";
import { get, ref, set } from "firebase/database";
import { auth, db } from "../firebaseConfig";

/**
 * Security: Input validation for email and password
 */
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain an uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain a lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain a number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain a special character");
  }

  return { valid: errors.length === 0, errors };
};

const validateName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 100;
};

/**
 * Security: Handle Firebase auth errors with user-friendly messages
 */
const getAuthErrorMessage = (errorCode: string): string => {
  const errorMap: Record<string, string> = {
    "auth/invalid-email": "Invalid email address",
    "auth/user-not-found": "No account found with this email",
    "auth/wrong-password": "Incorrect password",
    "auth/user-disabled": "This account has been disabled",
    "auth/email-already-in-use": "Email is already registered",
    "auth/weak-password": "Password is too weak",
    "auth/operation-not-allowed": "Sign up is currently disabled",
    "auth/too-many-requests": "Too many login attempts. Please try again later",
    "auth/network-request-failed": "Network error. Please check your connection",
  };

  return errorMap[errorCode] || "Authentication failed. Please try again";
};

/**
 * Security: Signup with validation, role setup and error handling
 */
export const signupUser = async (
  email: string,
  password: string,
  name: string,
  role: "rider" | "driver"
): Promise<{ success: boolean; user?: User; error?: string; validationErrors?: string[] }> => {
  try {
    // Input validation
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!validateEmail(trimmedEmail)) {
      return { success: false, error: "Please enter a valid email address" };
    }

    if (!validateName(trimmedName)) {
      return { success: false, error: "Name must be between 2 and 100 characters" };
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return { 
        success: false, 
        validationErrors: passwordValidation.errors 
      };
    }

    // Create user in Firebase
    const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName: trimmedName });

      // Save role profile to Realtime Database
      await set(ref(db, `users/${userCredential.user.uid}`), {
        name: trimmedName,
        email: trimmedEmail,
        role: role,
        createdAt: Date.now()
      });
    }

    return {
      success: true,
      user: userCredential.user,
    };
  } catch (error: any) {
    console.error("Signup error:", error.code, error.message);
    return {
      success: false,
      error: getAuthErrorMessage(error.code),
    };
  }
};

/**
 * Security: Login with validation and error handling
 */
export const loginUser = async (
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    // Input validation
    const trimmedEmail = email.trim().toLowerCase();

    if (!validateEmail(trimmedEmail)) {
      return { success: false, error: "Please enter a valid email address" };
    }

    if (!password || password.length === 0) {
      return { success: false, error: "Please enter your password" };
    }

    // Sign in with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);

    return {
      success: true,
      user: userCredential.user,
    };
  } catch (error: any) {
    console.error("Login error:", error.code, error.message);
    return {
      success: false,
      error: getAuthErrorMessage(error.code),
    };
  }
};

/**
 * Security: Get user role from Realtime Database
 */
export const getUserRole = async (uid: string): Promise<"rider" | "driver" | null> => {
  try {
    const userRef = ref(db, `users/${uid}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return data.role || "rider";
    }
    return null;
  } catch (error) {
    console.error("Fetch user role error:", error);
    return null;
  }
};

/**
 * Security: Logout with proper cleanup
 */
export const logoutUser = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error: any) {
    console.error("Logout error:", error.message);
    return { success: false, error: "Failed to logout" };
  }
};

/**
 * Security: Listen to auth state changes for session management
 */
export const onAuthChange = (
  callback: (user: User | null) => void
): (() => void) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    callback(user);
  });

  return unsubscribe;
};

/**
 * Security: Get current user safely
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Security: Verify email is authenticated
 */
export const isUserAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};
