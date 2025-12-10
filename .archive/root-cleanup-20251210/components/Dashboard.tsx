import React, { useState, useEffect } from 'react';

interface CallRecord {
  id: string;
  name: string;
  phone: string;
  time: string;
  duration: string;
  outcome: 'Sale' | 'Interested' | 'No Answer' | 'Follow-up' | 'Rejected';
  status: 'success' | 'warning' | 'info' | 'danger' | 'neutral';
}

const initialCalls: CallRecord[] = [
  { id: '1', name: 'Jean-Paul M.', phone: '+250 788 123 ***', time: '10:42 AM', duration: '4m 12s', outcome: 'Sale', status: 'success' },
  { id: '2', name: 'Marie C.', phone: '+250 783 456 ***', time: '10:30 AM', duration: '1m 05s', outcome: 'Interested', status: 'warning' },
  { id: '3', name: 'Restaurant Chez Lando', phone: '+250 785 789 ***', time: '10:15 AM', duration: '0m 45s', outcome: 'No Answer', status: 'neutral' },
  { id: '4', name: 'Kigali Transport Ltd', phone: '+250 790 000 ***', time: '09:55 AM', duration: '6m 30s', outcome: 'Follow-up', status: 'info' },
  { id: '5', name: 'Eric N.', phone: '+250 781 234 ***', time: '09:40 AM', duration: '2m 10s', outcome: 'Rejected', status: 'danger' },
];

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    activeCalls: 12,
    latency: 42,
    sales: 482,
    contacts: 1024
  });

  const [calls, setCalls] = useState<CallRecord[]>(initialCalls);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => {
        // Random walk for active calls
        const callChange = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        let newCalls = Math.max(0, Math.min(50, prev.activeCalls + callChange));
        
        // Random walk for latency to simulate network jitter
        const latChange = Math.floor(Math.random() * 15) - 7;
        let newLatency = Math.max(20, Math.min(150, prev.latency + latChange));

        return {
          ...prev,
          activeCalls: newCalls,
          latency: newLatency
        };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const updateCallOutcome = (id: string, newOutcome: CallRecord['outcome']) => {
      setCalls(prev => prev.map(call => {
          if (call.id === id) {
              let status: CallRecord['status'] = 'neutral';
              switch(newOutcome) {
                  case 'Sale': status = 'success'; break;
                  case 'Interested': status = 'warning'; break;
                  case 'Follow-up': status = 'info'; break;
                  case 'Rejected': status = 'danger'; break;
                  case 'No Answer': status = 'neutral'; break;
              }
              return { ...call, outcome: newOutcome, status };
          }
          return call;
      }));
  };

  const getConnectionHealth = (latency: number) => {
    if (latency < 50) return { status: 'Excellent', color: 'text-green-600', iconColor: 'text-green-500 bg-green-50' };
    if (latency < 100) return { status: 'Good', color: 'text-blue-600', iconColor: 'text-blue-500 bg-blue-50' };
    if (latency < 150) return { status: 'Fair', color: 'text-amber-600', iconColor: 'text-amber-500 bg-amber-50' };
    return { status: 'Poor', color: 'text-red-600', iconColor: 'text-red-500 bg-red-50' };
  };

  const health = getConnectionHealth(stats.latency);

  return (
    <div className="flex flex-col gap-6 mb-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Active Calls Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 text-xs font-bold uppercase">Active Channels</h3>
              <i className="fas fa-phone-alt text-blue-500 bg-blue-50 p-2 rounded-lg"></i>
          </div>
          <div className="text-2xl font-bold text-gray-800">{stats.activeCalls} / 50</div>
          <div className="text-xs text-gray-500 flex items-center mt-1">
              <div className={`w-2 h-2 rounded-full mr-2 ${stats.activeCalls > 45 ? 'bg-red-500' : stats.activeCalls > 30 ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`}></div>
              SIP Trunk Usage: {Math.round((stats.activeCalls / 50) * 100)}%
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-blue-100 w-full">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(stats.activeCalls/50)*100}%` }}></div>
          </div>
        </div>
        
        {/* Sales Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 text-xs font-bold uppercase">EasyMo Sales</h3>
              <i className="fas fa-money-bill-wave text-green-500 bg-green-50 p-2 rounded-lg"></i>
          </div>
          <div className="text-2xl font-bold text-gray-800">{stats.sales}</div>
          <div className="text-xs text-green-500 flex items-center mt-1">
              <i className="fas fa-arrow-up mr-1"></i> +24% this week
          </div>
        </div>

        {/* Contacts Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 text-xs font-bold uppercase">Contacts Found</h3>
              <i className="fas fa-address-book text-amber-500 bg-amber-50 p-2 rounded-lg"></i>
          </div>
          <div className="text-2xl font-bold text-gray-800">{stats.contacts.toLocaleString()}</div>
          <div className="text-xs text-gray-400 flex items-center mt-1">
              From Google Search/Maps
          </div>
        </div>

        {/* MTN Connection Health Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 text-xs font-bold uppercase">MTN Connection</h3>
              <i className={`fas fa-signal ${health.iconColor} p-2 rounded-lg`}></i>
          </div>
          <div className={`text-2xl font-bold ${health.color}`}>{health.status}</div>
          <div className="text-xs text-gray-500 flex items-center mt-1">
              <i className="fas fa-network-wired mr-1"></i> Latency: {stats.latency}ms
          </div>
        </div>
      </div>

      {/* Call History Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
         <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center">
                <i className="fas fa-history text-gray-400 mr-2"></i>
                <h3 className="text-lg font-bold text-gray-800">Recent Call History</h3>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">View All Logs</button>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                     <th className="px-6 py-3">Contact Name</th>
                     <th className="px-6 py-3">Phone (Masked)</th>
                     <th className="px-6 py-3">Time</th>
                     <th className="px-6 py-3">Duration</th>
                     <th className="px-6 py-3">Outcome</th>
                     <th className="px-6 py-3 text-center">Log</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {calls.map(call => (
                     <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{call.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{call.phone}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{call.time}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">{call.duration}</td>
                        <td className="px-6 py-4">
                           <div className="relative w-40">
                             <select
                                value={call.outcome}
                                onChange={(e) => updateCallOutcome(call.id, e.target.value as CallRecord['outcome'])}
                                className={`appearance-none block w-full px-3 py-1.5 pr-8 text-xs font-bold rounded-full border cursor-pointer transition-shadow focus:outline-none focus:ring-2 focus:ring-offset-1
                                   ${call.outcome === 'Sale' ? 'bg-green-50 text-green-700 border-green-200 focus:ring-green-500' :
                                     call.outcome === 'Interested' ? 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-500' :
                                     call.outcome === 'Follow-up' ? 'bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-500' :
                                     call.outcome === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-500' :
                                     'bg-gray-50 text-gray-600 border-gray-200 focus:ring-gray-400'}`}
                             >
                                <option value="Sale">Sale</option>
                                <option value="Interested">Interested</option>
                                <option value="Follow-up">Follow-up</option>
                                <option value="No Answer">No Answer</option>
                                <option value="Rejected">Rejected</option>
                             </select>
                             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <i className="fas fa-chevron-down text-[10px] opacity-70"></i>
                             </div>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <button className="text-gray-400 hover:text-blue-600 transition-colors">
                                <i className="fas fa-file-alt"></i>
                           </button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
