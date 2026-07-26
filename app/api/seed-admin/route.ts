import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { adminCreateUser, adminListUsers } from '@/lib/db/auth';

export async function POST() {
  try {
    const supabase = supabaseAdmin;

    const admins = [
      { email: 'admin@boutique.store', password: 'G7z!pL9q#V2mR4xT' },
      { email: 'owner@boutique.store', password: 'Kx8#mW3nP5vQ9jBr' },
    ];

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const { email, password } of admins) {
      let userId: string | null = null;

      const { user: created, error: createError } = await adminCreateUser({
        email,
        password,
        email_confirm: true,
      });

      if (created) {
        userId = created.id;
      } else if (createError) {
        const { users, error: listError } = await adminListUsers({ page: 1, perPage: 1000 });

        if (listError) {
          results.push({ email, success: false, error: `Failed to list users: ${listError}` });
          continue;
        }

        const existing =
          users.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase()) ?? null;

        if (!existing) {
          results.push({
            email,
            success: false,
            error: `User not found and could not be created: ${createError}`,
          });
          continue;
        }

        userId = existing.id;
      }

      if (!userId) {
        results.push({ email, success: false, error: 'Could not determine user id' });
        continue;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', userId);

      if (profileError) {
        results.push({
          email,
          success: false,
          error: `Failed to update profile role: ${profileError.message}`,
        });
        continue;
      }

      results.push({ email, success: true });
    }

    const allSucceeded = results.every((r) => r.success);

    return NextResponse.json(
      {
        success: allSucceeded,
        results,
        message: allSucceeded
          ? 'All admin users ensured and roles set to admin.'
          : 'Some admin users failed — check results for details.',
      },
      { status: allSucceeded ? 200 : 207 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
