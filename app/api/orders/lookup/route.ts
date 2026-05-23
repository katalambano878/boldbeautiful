import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const RATE_LIMIT_WINDOW = 60_000;
const MAX_REQUESTS = 10;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > MAX_REQUESTS;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const { order_number, email } = body;

    if (!order_number || typeof order_number !== 'string') {
      return NextResponse.json({ error: 'Order number is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required for order lookup' }, { status: 400 });
    }

    const sanitizedOrderNumber = order_number.trim().substring(0, 50);
    const sanitizedEmail = email.trim().toLowerCase().substring(0, 254);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        email,
        phone,
        status,
        payment_status,
        currency,
        subtotal,
        tax_total,
        shipping_total,
        discount_total,
        total,
        shipping_method,
        payment_method,
        shipping_address,
        metadata,
        created_at,
        order_items (
          id,
          product_name,
          variant_name,
          quantity,
          unit_price,
          metadata,
          products (
            product_images (url)
          )
        )
      `)
      .eq('order_number', sanitizedOrderNumber)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.email?.toLowerCase() !== sanitizedEmail) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { email: _email, phone: _phone, ...safeOrder } = order;

    return NextResponse.json({
      success: true,
      order: {
        ...safeOrder,
        email_masked: sanitizedEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      },
    });
  } catch (err: any) {
    console.error('Order lookup error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
