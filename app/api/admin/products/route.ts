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

    const { productIds } = await request.json();
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'productIds array required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    for (const productId of productIds) {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', productId);

      const variantIds = variants?.map(v => v.id) || [];

      if (variantIds.length > 0) {
        await supabase.from('cart_items').delete().in('variant_id', variantIds);
        await supabase.from('order_items').update({ variant_id: null }).in('variant_id', variantIds);
      }

      await supabase.from('cart_items').delete().eq('product_id', productId);
      await supabase.from('wishlist_items').delete().eq('product_id', productId);
      await supabase.from('reviews').delete().eq('product_id', productId);
      await supabase.from('order_items').update({ product_id: null }).eq('product_id', productId);
      await supabase.from('product_images').delete().eq('product_id', productId);
      await supabase.from('product_variants').delete().eq('product_id', productId);

      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, deleted: productIds.length });
  } catch (err: any) {
    console.error('Product delete error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete product(s)' },
      { status: 500 }
    );
  }
}
