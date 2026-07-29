import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { asNumber } from '@/lib/format-money';

export async function POST(req: Request) {
    try {
        // Rate limiting
        const clientId = getClientIdentifier(req);
        const rateLimitResult = checkRateLimit(`payment:${clientId}`, RATE_LIMITS.payment);
        
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { success: false, message: 'Too many requests. Please try again later.' },
                { 
                    status: 429,
                    headers: {
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetIn.toString()
                    }
                }
            );
        }

        const body = await req.json();
        const { orderId, customerEmail } = body;

        if (!orderId) {
            return NextResponse.json({ success: false, message: 'Missing orderId' }, { status: 400 });
        }

        // Trusted amount from DB order — never trust client-supplied amount
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('order_number, total, payment_status, email, currency, metadata')
            .eq('order_number', orderId)
            .maybeSingle();

        if (orderError || !order) {
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }
        if (order.payment_status === 'paid') {
            return NextResponse.json({ success: false, message: 'Order already paid' }, { status: 400 });
        }

        const amount = asNumber(order.total);
        if (!(amount > 0)) {
            return NextResponse.json({ success: false, message: 'Invalid order total' }, { status: 400 });
        }

        // Ensure environment variables are set
        if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY || !process.env.MOOLRE_ACCOUNT_NUMBER) {
            console.error('Missing Moolre credentials');
            return NextResponse.json({ success: false, message: 'Payment gateway configuration error' }, { status: 500 });
        }

        const requestUrl = new URL(req.url);
        // Remove trailing slash to prevent double-slash in URLs (e.g. //api/...)
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin).replace(/\/+$/, '');

        // Generate a unique external reference for Moolre
        // Append a retry suffix so re-payments don't clash with previous attempts
        const uniqueRef = `${orderId}-R${Date.now()}`;

        // Moolre Payload
        const payload = {
            type: 1,
            amount: amount.toFixed(2),
            email: process.env.MOOLRE_MERCHANT_EMAIL || 'pobeenina2@gmail.com',
            externalref: uniqueRef,
            callback: `${baseUrl}/api/payment/moolre/callback`,
            redirect: `${baseUrl}/order-success?order=${orderId}&payment_success=true`,
            reusable: "0",
            currency: order.currency || "GHS",
            accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
            metadata: {
                customer_email: customerEmail || order.email,
                original_order_number: orderId
            }
        };

        console.log('[Payment] Initiating for order:', orderId, '| Amount:', amount, '| Callback:', payload.callback);

        // Persist attempt ref so verify can query Moolre with the exact externalref
        const prevMeta =
            order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
                ? order.metadata
                : {};
        await supabase
            .from('orders')
            .update({
                metadata: {
                    ...prevMeta,
                    payment_method: 'moolre',
                    last_moolre_externalref: uniqueRef,
                    last_payment_attempt_at: new Date().toISOString(),
                },
            })
            .eq('order_number', orderId);

        const response = await fetch('https://api.moolre.com/embed/link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-USER': process.env.MOOLRE_API_USER,
                'X-API-PUBKEY': process.env.MOOLRE_API_PUBKEY
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('[Payment] Response status:', result.status, '| Has URL:', !!result.data?.authorization_url);

        if (result.status === 1 && result.data?.authorization_url) {
            return NextResponse.json({ success: true, url: result.data.authorization_url, reference: result.data.reference });
        } else {
            return NextResponse.json({ success: false, message: result.message || 'Failed to generate payment link' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Payment API Error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
