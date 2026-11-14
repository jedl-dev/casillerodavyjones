import { supabase } from './supabase';

export const signInAdmin = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOutAdmin = () => supabase.auth.signOut();

export const getSession = () => supabase.auth.getSession();

export const onAuthChange = (callback) => supabase.auth.onAuthStateChange(
  (_event, session) => callback(session)
);
