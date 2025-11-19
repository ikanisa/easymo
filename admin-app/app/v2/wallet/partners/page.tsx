'use client';

import { useState, useEffect } from 'react';

interface Partner {
  id: string;
  name: string;
  whatsapp_e164: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

interface PartnerStats {
  id: string;
  name: string;
  category: string | null;
  whatsapp_e164: string;
  is_active: boolean;
  total_transactions: number;
  total_tokens_received: number;
  avg_transaction_size: number;
  last_transaction_at: string | null;
}

const CATEGORIES = [
  { value: 'petrol_station', label: '⛽ Petrol Station', icon: '⛽' },
  { value: 'supermarket', label: '🛒 Supermarket', icon: '🛒' },
  { value: 'restaurant', label: '🍽️ Restaurant', icon: '🍽️' },
  { value: 'pharmacy', label: '💊 Pharmacy', icon: '💊' },
  { value: 'retail', label: '🏪 Retail', icon: '🏪' },
  { value: 'services', label: '⚙️ Services', icon: '⚙️' },
  { value: 'utility', label: '💡 Utility', icon: '💡' },
  { value: 'transport', label: '🚗 Transport', icon: '🚗' },
  { value: 'accommodation', label: '🏨 Accommodation', icon: '🏨' },
];

export default function WalletPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [stats, setStats] = useState<PartnerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    whatsappE164: '+250',
    category: 'petrol_station',
    isActive: true,
  });

  useEffect(() => {
    fetchPartners();
    fetchStats();
  }, [categoryFilter]);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (categoryFilter) params.set('category', categoryFilter);
      const res = await fetch(`/api/wallet/partners?${params}`);
      const json = await res.json();
      setPartners(json.data || []);
    } catch (error) {
      console.error('Failed to fetch partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // In a real app, create an API endpoint for stats
      // For now, we'll just use the partners data
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await fetch(`/api/wallet/partners/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch('/api/wallet/partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setShowAddModal(false);
      setEditingId(null);
      setFormData({ name: '', whatsappE164: '+250', category: 'petrol_station', isActive: true });
      fetchPartners();
    } catch (error) {
      console.error('Failed to save partner:', error);
      alert('Failed to save partner');
    }
  };

  const handleEdit = (partner: Partner) => {
    setFormData({
      name: partner.name,
      whatsappE164: partner.whatsapp_e164,
      category: partner.category || 'petrol_station',
      isActive: partner.is_active,
    });
    setEditingId(partner.id);
    setShowAddModal(true);
  };

  const handleToggleActive = async (partnerId: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/wallet/partners/${partnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      fetchPartners();
    } catch (error) {
      console.error('Failed to toggle partner status:', error);
    }
  };

  const handleDelete = async (partnerId: string) => {
    if (!confirm('Are you sure you want to deactivate this partner?')) return;
    try {
      await fetch(`/api/wallet/partners/${partnerId}`, { method: 'DELETE' });
      fetchPartners();
    } catch (error) {
      console.error('Failed to delete partner:', error);
    }
  };

  const getCategoryInfo = (category: string | null) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat || { label: category || 'Unknown', icon: '📍' };
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Token Partners</h1>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Token Partners</h1>
          <p className="text-gray-600">Partners that accept tokens as payment</p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', whatsappE164: '+250', category: 'petrol_station', isActive: true });
            setEditingId(null);
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Partner
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Total Partners</div>
          <div className="text-2xl font-bold">{partners.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Active Partners</div>
          <div className="text-2xl font-bold text-green-600">
            {partners.filter(p => p.is_active).length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Petrol Stations</div>
          <div className="text-2xl font-bold">
            {partners.filter(p => p.category === 'petrol_station').length}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-gray-500 text-sm">Other Merchants</div>
          <div className="text-2xl font-bold">
            {partners.filter(p => p.category !== 'petrol_station').length}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <label className="mr-2 text-sm font-medium">Category:</label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.icon} {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Partners Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Partner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                WhatsApp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {partners.map((partner) => {
              const catInfo = getCategoryInfo(partner.category);
              return (
                <tr key={partner.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {partner.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center">
                      <span className="mr-1">{catInfo.icon}</span>
                      {catInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {partner.whatsapp_e164}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(partner.id, partner.is_active)}
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        partner.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {partner.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(partner.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(partner)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(partner.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Edit Partner' : 'Add New Partner'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Partner Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="SP Petrol Station"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
                <input
                  type="tel"
                  value={formData.whatsappE164}
                  onChange={(e) => setFormData({ ...formData, whatsappE164: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="+250788767816"
                  pattern="^\+[1-9]\d{6,14}$"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Format: +country code + number</p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
