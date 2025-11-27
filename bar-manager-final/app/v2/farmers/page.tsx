'use client';

import { useEffect,useState } from 'react';

interface Farm {
  id: string;
  farm_name: string;
  district: string;
  sector: string;
  hectares: number;
  commodities: string[];
  phone_number: string;
  status: string;
  created_at: string;
}

export default function FarmersPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchFarms();
  }, [page]);

  const fetchFarms = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/farmers?page=${page}&limit=20`);
      const json = await res.json();
      setFarms(json.data || []);
      setTotal(json.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch farms:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (farmId: string, newStatus: string) => {
    try {
      await fetch(`/api/farmers/${farmId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchFarms();
    } catch (error) {
      console.error('Failed to update farm:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Farmers & Farms</h1>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Farmers & Farms</h1>
        <p className="text-gray-600">Total farms: {total}</p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Farm Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Size (ha)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Commodities
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {farms.map((farm) => (
              <tr key={farm.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {farm.farm_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {farm.district}, {farm.sector}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {farm.hectares || 'N/A'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {farm.commodities?.join(', ') || 'None'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {farm.phone_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      farm.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {farm.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => updateStatus(farm.id, farm.status === 'active' ? 'inactive' : 'active')}
                    className="text-indigo-600 hover:text-indigo-900 mr-2"
                  >
                    {farm.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-white border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-700">
          Page {page} of {Math.ceil(total / 20)}
        </span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={page >= Math.ceil(total / 20)}
          className="px-4 py-2 bg-white border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
