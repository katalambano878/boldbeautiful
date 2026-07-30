'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { money } from '@/lib/format-money';

type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

interface CouponForm {
  code: string;
  description: string;
  type: DiscountType;
  value: string;
  minimum_purchase: string;
  maximum_discount: string;
  usage_limit: string;
  per_user_limit: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const emptyForm = (): CouponForm => ({
  code: '',
  description: '',
  type: 'percentage',
  value: '',
  minimum_purchase: '0',
  maximum_discount: '',
  usage_limit: '',
  per_user_limit: '1',
  start_date: '',
  end_date: '',
  is_active: true,
});

function mapTypeLabel(type: string) {
  if (type === 'fixed_amount' || type === 'fixed') return 'Fixed Amount';
  if (type === 'free_shipping') return 'Free Shipping';
  return 'Percentage';
}

function couponStatus(c: any) {
  if (!c.is_active) return 'Disabled';
  if (c.end_date && new Date(c.end_date) < new Date()) return 'Expired';
  if (c.start_date && new Date(c.start_date) > new Date()) return 'Scheduled';
  if (c.usage_limit != null && (c.usage_count || 0) >= c.usage_limit) return 'Expired';
  return 'Active';
}

export default function AdminCouponsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm());
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All Status');

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setCoupons(
        (data || []).map((c: any) => ({
          id: c.id,
          code: c.code,
          description: c.description || '',
          rawType: c.type,
          type: mapTypeLabel(c.type),
          value: Number(c.value ?? 0),
          minPurchase: Number(c.minimum_purchase ?? 0),
          maxDiscount: c.maximum_discount != null ? Number(c.maximum_discount) : null,
          usageLimit: c.usage_limit,
          usedCount: c.usage_count || 0,
          perUserLimit: c.per_user_limit ?? 1,
          startDate: c.start_date ? new Date(c.start_date).toLocaleDateString() : 'N/A',
          endDate: c.end_date ? new Date(c.end_date).toLocaleDateString() : null,
          start_date: c.start_date,
          end_date: c.end_date,
          is_active: c.is_active,
          status: couponStatus(c),
        }))
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const statusColors: Record<string, string> = {
    Active: 'bg-gray-100 text-gray-900',
    Scheduled: 'bg-blue-100 text-blue-700',
    Expired: 'bg-gray-100 text-gray-700',
    Disabled: 'bg-red-100 text-red-700',
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setShowModal(true);
  };

  const openEdit = (coupon: any) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code || '',
      description: coupon.description || '',
      type: (coupon.rawType === 'fixed' ? 'fixed_amount' : coupon.rawType) || 'percentage',
      value: String(coupon.value ?? ''),
      minimum_purchase: String(coupon.minPurchase ?? 0),
      maximum_discount: coupon.maxDiscount != null ? String(coupon.maxDiscount) : '',
      usage_limit: coupon.usageLimit != null ? String(coupon.usageLimit) : '',
      per_user_limit: String(coupon.perUserLimit ?? 1),
      start_date: coupon.start_date ? String(coupon.start_date).slice(0, 10) : '',
      end_date: coupon.end_date ? String(coupon.end_date).slice(0, 10) : '',
      is_active: !!coupon.is_active,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setError(null);
    const code = form.code.trim().toUpperCase();
    if (!code) {
      setError('Coupon code is required');
      return;
    }
    const value = form.type === 'free_shipping' ? 0 : Number(form.value);
    if (form.type !== 'free_shipping' && (Number.isNaN(value) || value < 0)) {
      setError('Enter a valid discount value');
      return;
    }
    if (form.type === 'percentage' && value > 100) {
      setError('Percentage cannot exceed 100');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code,
        description: form.description.trim() || null,
        type: form.type,
        value,
        minimum_purchase: Number(form.minimum_purchase) || 0,
        maximum_discount: form.maximum_discount === '' ? null : Number(form.maximum_discount),
        usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
        per_user_limit: form.per_user_limit === '' ? 1 : Number(form.per_user_limit),
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(`${form.end_date}T23:59:59`).toISOString() : null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('coupons').insert([{
          ...payload,
          usage_count: 0,
        }]);
        if (insertError) throw insertError;
      }

      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm());
      await fetchCoupons();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete coupon ${code}?`)) return;
    try {
      const { error: delError } = await supabase.from('coupons').delete().eq('id', id);
      if (delError) throw delError;
      await fetchCoupons();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete coupon');
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
  };

  const activeCoupons = coupons.filter((c) => c.status === 'Active');
  const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0);
  const filtered = coupons.filter((c) =>
    statusFilter === 'All Status' ? true : c.status === statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupons & Promotions</h1>
          <p className="text-gray-600 mt-1">Create and manage discount codes</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line mr-2"></i>
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Coupons</p>
          <p className="text-2xl font-bold text-gray-900">{coupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-gray-900">{activeCoupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Uses</p>
          <p className="text-2xl font-bold text-gray-900">{totalUses}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Live Codes</p>
          <p className="text-2xl font-bold text-gray-900">{activeCoupons.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">All Coupons</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 font-medium cursor-pointer"
            >
              <option>All Status</option>
              <option>Active</option>
              <option>Scheduled</option>
              <option>Expired</option>
              <option>Disabled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Code</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Value</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Min Purchase</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Usage</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Valid Period</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading coupons...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No coupons found.</td></tr>
              ) : (
                filtered.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">{coupon.code}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(coupon.code)}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors cursor-pointer"
                        >
                          <i className="ri-file-copy-line"></i>
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700">{coupon.type}</td>
                    <td className="py-4 px-4 font-semibold text-gray-900">
                      {coupon.type === 'Percentage'
                        ? `${coupon.value}%`
                        : coupon.type === 'Fixed Amount'
                          ? `GH₵ ${money(coupon.value)}`
                          : 'Free Shipping'}
                    </td>
                    <td className="py-4 px-4 text-gray-700 whitespace-nowrap">
                      {coupon.minPurchase > 0 ? `GH₵ ${money(coupon.minPurchase)}` : 'No minimum'}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-900 font-semibold">{coupon.usedCount}</span>
                        <span className="text-gray-500">/</span>
                        <span className="text-gray-600">{coupon.usageLimit || '∞'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-700 whitespace-nowrap">{coupon.startDate}</p>
                      <p className="text-sm text-gray-500 whitespace-nowrap">{coupon.endDate || 'No expiry'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[coupon.status] || 'bg-gray-100'}`}>
                        {coupon.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => openEdit(coupon)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <i className="ri-edit-line text-lg"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(coupon.id, coupon.code)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 sm:p-8 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingId ? 'Edit Coupon' : 'Create Coupon'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Code</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg font-mono"
                  placeholder="SAVE10"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                  placeholder="Optional note"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as DiscountType })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed Amount</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    {form.type === 'percentage' ? 'Percent' : 'Amount (GH₵)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={form.type === 'free_shipping'}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg disabled:bg-gray-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Min purchase</label>
                  <input
                    type="number"
                    min="0"
                    value={form.minimum_purchase}
                    onChange={(e) => setForm({ ...form, minimum_purchase: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Max discount</label>
                  <input
                    type="number"
                    min="0"
                    value={form.maximum_discount}
                    onChange={(e) => setForm({ ...form, maximum_discount: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Usage limit</label>
                  <input
                    type="number"
                    min="1"
                    value={form.usage_limit}
                    onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Per-user limit</label>
                  <input
                    type="number"
                    min="1"
                    value={form.per_user_limit}
                    onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Start date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">End date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Active
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
