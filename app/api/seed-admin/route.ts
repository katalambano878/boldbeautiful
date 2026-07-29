import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { adminCreateUser, adminListUsers } from '@/lib/db/auth';

/**
 * Bootstrap admin users. Disabled unless SEED_ADMIN_SECRET is set and
 * provided as Authorization: Bearer <secret>.
 * Do not ship hardcoded passwords — pass them in the request body.
 */
export async function POST(request: Request) {
  const seedSecret = process.env.SEED_ADMIN_SECRET;
  if (!seedSecret) {
    return NextResponse.json(
      { error: 'seed-admin is disabled (SEED_ADMIN_SECRET not configured)' },
      { status: 404 }
    );
  }

  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${seedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const admins = Array.isArray(body.admins) ? body.admins : null;

    if (!admins?.length) {
      return NextResponse.json(
        {
          error:
            'Provide { "admins": [{ "email": "...", "password": "..." }] } — passwords are not stored in source.',
        },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const entry of admins) {
      const email = String(entry.email || '').trim().toLowerCase();
      const password = String(entry.password || '');
      if (!email || password.length < 10) {
        results.push({ email: email || '(missing)', success: false, error: 'Invalid email/password' });
        continue;
      }

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
          users.find((u) => u.email && u.email.toLowerCase() === email) ?? null;

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
