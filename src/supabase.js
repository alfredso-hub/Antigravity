import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://tmjhkebzxclyianmdyns.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MDLZ4O4Z7AJSPyAKTc66ZQ_m_FjP94h';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/'
        }
    });
    if (error) console.error('Login error:', error);
    return { data, error };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error);
    return { error };
}

export async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}
