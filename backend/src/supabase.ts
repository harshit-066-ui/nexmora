// =============================================
// Supabase Service Role Client (Backend Only)
// =============================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Service role client — bypasses RLS, used for all DB writes
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Anon client — used only for JWT verification
export const supabaseAnon: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export { supabaseUrl, supabaseAnonKey };
