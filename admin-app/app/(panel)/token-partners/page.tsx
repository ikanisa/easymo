"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface TokenPartner {
  id: string;
  name: string;
  whatsapp_e164: string | null;
  category: string | null;
  is_active: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface PartnerStats {
  total_partners: number;
  active_partners: number;
  total_transactions: number;
  total_tokens_transferred: number;
}

export default function TokenPartnersPage() {
  const [partners, setPartners] = useState<TokenPartner[]>([]);
  const [stats, setStats] = useState<PartnerStats>({
    total_partners: 0,
    active_partners: 0,
    total_transactions: 0,
    total_tokens_transferred: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchPartners();
    fetchStats();
  }, []);

  async function fetchPartners() {
    try {
      const { data, error } = await supabase
        .from("token_partners")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error("Error fetching partners:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const { data: partnersData } = await supabase
        .from("token_partners")
        .select("id, is_active");

      const { data: statsData } = await supabase
        .from("token_partner_stats")
        .select("total_transactions, total_tokens_received");

      const totalPartners = partnersData?.length || 0;
      const activePartners = partnersData?.filter((p) => p.is_active).length || 0;
      const totalTransactions = statsData?.reduce((sum, s) => sum + (s.total_transactions || 0), 0) || 0;
      const totalTokens = statsData?.reduce((sum, s) => sum + (s.total_tokens_received || 0), 0) || 0;

      setStats({
        total_partners: totalPartners,
        active_partners: activePartners,
        total_transactions: totalTransactions,
        total_tokens_transferred: totalTokens,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }

  async function togglePartnerStatus(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from("token_partners")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      
      // Refresh data
      fetchPartners();
      fetchStats();
    } catch (error) {
      console.error("Error toggling partner status:", error);
      alert("Failed to update partner status");
    }
  }

  const filteredPartners = partners.filter((partner) => {
    const matchesSearch = 
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.whatsapp_e164?.includes(searchTerm);
    const matchesCategory = categoryFilter === "all" || partner.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(partners.map((p) => p.category).filter(Boolean)));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Token Recipient Partners</h1>
        <p className="text-gray-600">
          Manage partners who accept EasyMO tokens for payments (petrol stations, supermarkets, etc.)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-1">Total Partners</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total_partners}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-1">Active Partners</div>
          <div className="text-3xl font-bold text-green-600">{stats.active_partners}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-1">Total Transactions</div>
          <div className="text-3xl font-bold text-blue-600">{stats.total_transactions}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-1">Tokens Transferred</div>
          <div className="text-3xl font-bold text-purple-600">{stats.total_tokens_transferred.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by name or WhatsApp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat || ""}>
                  {cat?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Partners Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Partner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  WhatsApp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading partners...
                  </td>
                </tr>
              ) : filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No partners found
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{partner.name}</div>
                      {partner.metadata?.location && (
                        <div className="text-sm text-gray-500">{partner.metadata.location}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{partner.whatsapp_e164 || "—"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {partner.category?.replace(/_/g, " ") || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          partner.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {partner.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(partner.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => togglePartnerStatus(partner.id, partner.is_active)}
                        className={`${
                          partner.is_active
                            ? "text-red-600 hover:text-red-900"
                            : "text-green-600 hover:text-green-900"
                        }`}
                      >
                        {partner.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 text-sm text-gray-600">
        Showing {filteredPartners.length} of {partners.length} partners
      </div>
    </div>
  );
}
