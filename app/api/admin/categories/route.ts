import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function verifyAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' || profile?.role === 'staff';
}

export async function DELETE(request: Request) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { categoryId } = await request.json();
    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: children } = await supabase
      .from('categories')
      .select('id, name')
      .eq('parent_id', categoryId);

    if (children && children.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete: has ${children.length} sub-categor${children.length === 1 ? 'y' : 'ies'} (${children.map(c => c.name).join(', ')}). Reassign or delete them first.`,
        },
        { status: 409 }
      );
    }

    await supabase
      .from('products')
      .update({ category_id: null })
      .eq('category_id', categoryId);

    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Category delete error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete category' },
      { status: 500 }
    );
  }
}
