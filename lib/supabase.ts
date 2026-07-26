import { createSupabaseHttpClient } from './db/http-client';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3004');
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'local-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn(
    '[Supabase] NEXT_PUBLIC_SUPABASE_URL not set; using same-origin shim base for HTTP client.'
  );
}

export const supabase = createSupabaseHttpClient(supabaseUrl, supabaseKey);
