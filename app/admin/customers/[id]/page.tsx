'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { asNumber, money } from '@/lib/format-money';

export default function CustomerDetailsPage() {
    const params = useParams();
    const customerId = params.id as string;

    const [customer, setCustomer] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCustomerData = useCallback(async () => {
        try {
            setLoading(true);

            // Admin list links to customers.id (guests + registered)
            const { data: customerRow, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .maybeSingle();

            let resolved = customerRow;

            // Legacy fallback: id may be a profiles/auth user id
            if (!resolved) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', customerId)
                    .maybeSingle();

                if (profile) {
                    resolved = {
                        id: profile.id,
                        user_id: profile.id,
                        email: profile.email,
                        full_name: profile.full_name,
                        phone: profile.phone,
                        total_orders: 0,
                        total_spent: 0,
                        created_at: profile.created_at,
                    };
                }
            }

            if (!resolved) {
                setCustomer(null);
                setOrders([]);
                return;
            }

            const orderMap = new Map<string, any>();

            if (resolved.email) {
                const { data: byEmail } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('email', resolved.email)
                    .order('created_at', { ascending: false });
                (byEmail || []).forEach((o: any) => orderMap.set(o.id, o));
            }

            if (resolved.user_id) {
                const { data: byUser } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', resolved.user_id)
                    .order('created_at', { ascending: false });
                (byUser || []).forEach((o: any) => orderMap.set(o.id, o));
            }

            const ordersData = Array.from(orderMap.values()).sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setCustomer(resolved);
            setOrders(ordersData);
        } catch (err) {
            console.error('Error fetching customer:', err);
            setCustomer(null);
        } finally {
            setLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        if (customerId) {
            fetchCustomerData();
        }
    }, [customerId, fetchCustomerData]);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading customer details...</div>;
    if (!customer) return <div className="p-8 text-center text-red-500">Customer not found</div>;

    const displayName =
        customer.full_name ||
        [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
        'No Name';
    const totalSpent =
        asNumber(customer.total_spent) ||
        orders.reduce((sum, order) => sum + asNumber(order.total), 0);
    const totalOrders = customer.total_orders || orders.length;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <Link href="/admin/customers" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                        <i className="ri-arrow-left-line text-xl"></i>
                    </Link>
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 text-2xl font-bold">
                        {(displayName !== 'No Name' ? displayName : customer.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{displayName}</h1>
                        <p className="text-gray-500">{customer.email}</p>
                        {!customer.user_id && (
                            <span className="inline-block mt-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                Guest customer
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Total Spent</p>
                    <p className="text-2xl font-bold text-gray-900">GH₵{money(totalSpent)}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Last Order</p>
                    <p className="text-xl font-bold text-gray-900">
                        {orders[0]
                            ? new Date(orders[0].created_at).toLocaleDateString()
                            : customer.last_order_at
                                ? new Date(customer.last_order_at).toLocaleDateString()
                                : 'Never'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
                    <p className="text-lg font-bold text-gray-900">{customer.phone || 'N/A'}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Order History</h2>
                </div>

                {orders.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No orders found.</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Order</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map(order => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-600">
                                        <Link href={`/admin/orders/${order.id}`}>
                                            #{order.order_number || order.id.slice(0, 8)}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                            ${order.status === 'completed' || order.status === 'delivered' ? 'bg-gray-100 text-gray-800' :
                                                order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {String(order.status || '').replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-900">
                                        GH₵{money(order.total || 0)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link href={`/admin/orders/${order.id}`} className="text-gray-400 hover:text-gray-600">
                                            <i className="ri-eye-line text-lg"></i>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
