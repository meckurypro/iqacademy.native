// src/core/authActions.ts
// Auth calls for the sign-in screens. Raw Supabase access is limited to src/core and src/data (ESLint), so features/auth goes through here.
// The email links open the app: iqacademy://auth/callback  (handled by src/app/auth/callback.tsx → core/authUrl.ts).
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

/** Where confirmation and recovery emails send the person. Must be on the Supabase Auth redirect allow-list (port/BACKEND.md). */
export const authRedirect = () => Linking.createURL("auth/callback");

export const signInWithPassword = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
export const signUpWithPassword = (email: string, password: string, fullName: string) =>
  supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: authRedirect() } });
export const sendResetLink = (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirect() });
export const resendSignupEmail = (email: string) => supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: authRedirect() } });
export async function updatePassword(password: string) { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; }
