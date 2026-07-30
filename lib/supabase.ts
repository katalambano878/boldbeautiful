import { createSupabaseHttpClient } from './db/http-client';

/**
 * Prefer same-origin in the browser so admin/POS never cross www↔apex
 * (avoids "Failed to fetch" / stuck loaders when env host ≠ page host).
 */
function resolveSupabaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3004'
  );
}

const supabaseUrl = resolveSupabaseUrl();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'local-anon-key';

export const supabase = createSupabaseHttpClient(supabaseUrl, supabaseKey);
