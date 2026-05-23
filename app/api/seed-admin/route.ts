import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const admins = [
    { email: 'admin@boutique.store', password: 'G7z!pL9q#V2mR4xT' },
    { email: 'owner@boutique.store', password: 'Kx8#mW3nP5vQ9jBr' },
  ];

  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const { email, password } of admins) {
    let userId: string | null = null;

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (!createError && created?.user) {
      userId = created.user.id;
    } else if (createError) {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (listError) {
        results.push({ email, success: false, error: `Failed to list users: ${listError.message}` });
        continue;
      }

      const existing =
        listData?.users?.find((u: any) => u.email && u.email.toLowerCase() === email.toLowerCase()) ??
        null;

      if (!existing) {
        results.push({ email, success: false, error: `User not found and could not be created: ${createError.message}` });
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
      results.push({ email, success: false, error: `Failed to update profile role: ${profileError.message}` });
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
}

