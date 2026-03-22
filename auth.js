import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://keimswznhkzmvxwrvrgh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlaW1zd3puaGt6bXZ4d3J2cmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTUxMDAsImV4cCI6MjA4OTc3MTEwMH0.iAgF9Ey-C6GMKbd0fUrPcdifhAsfz9iW0rm5EY7kj0o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─── JORIY FOYDALANUVCHI ─── */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/* ─── SIGN UP ─── */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/* ─── SIGN IN ─── */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/* ─── SIGN OUT ─── */
export async function signOut() {
  await supabase.auth.signOut();
}

/* ─── AUTH HOLATI O'ZGARGANDA ─── */
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}