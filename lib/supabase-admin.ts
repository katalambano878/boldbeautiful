import { createClient } from './db/supabase-compat';
import { isPlainPostgres } from './db/mode';

/**
 * Server-side admin client (plain Postgres only).
 * ONLY use in API routes / server actions — never in client components.
 */

function createAdminClient() {
  if (!isPlainPostgres()) {
    throw new Error(
      'DATABASE_URL is required for supabaseAdmin. Set DATABASE_URL (plain Postgres) before using the admin client.'
    );
  }
  return createClient();
}

export const supabaseAdmin: ReturnType<typeof createClient> = createAdminClient();
