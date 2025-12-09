'use client';

import { useState } from 'react';
import { Search, Plus, Calendar, Clock, User, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

const SAMPLE_STAFF = [
  { id: '1', name: 'Jean Mukiza', role: 'Manager', status: 'active', hoursWeek: 42, shift: 'Morning', phone: '+250788123456' },
  { id: '2', name: 'Grace Uwase', role: 'Server', status: 'active', hoursWeek: 38, shift: 'Evening', phone: '+250788234567' },
  { id: '3', name: 'Eric Niyonzima', role: 'Chef', status: 'active', hoursWeek: 45, shift: 'All Day', phone: '+250788345678' },
  { id: '4', name: 'Sarah Mutoni', role: 'Bartender', status: 'active', hoursWeek: 40, shift: 'Evening', phone: '+250788456789' },
  { id: '5', name: 'Patrick Habimana', role: 'Server', status: 'off', hoursWeek: 0, shift: 'Day Off', phone: '+250788567890' },
];

const SHIFTS = ['All Day', 'Morning', 'Evening', 'Night'];

export default function StaffPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [view, setView] = useState<'list' | 'schedule'>('list');

  const roles = ['all', 'Manager', 'Server', 'Chef', 'Bartender'];
  const filteredStaff = SAMPLE_STAFF.filter((staff) => {
    if (roleFilter !== 'all' && staff.role !== roleFilter) return false;
    if (searchQuery && !staff.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeStaff = SAMPLE_STAFF.filter(s => s.status === 'active').length;
  const totalHours = SAMPLE_STAFF.reduce((sum, s) => sum + s.hoursWeek, 0);

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Staff</h1>
            <p className="text-sm text-zinc-400">Manage team and schedules</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input placeholder="Search staff..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-64 bg-zinc-900 border-zinc-800 pl-9" />
            </div>
            <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
              <button onClick={() => setView('list')} className={cn('rounded px-3 py-2 text-sm', view === 'list' ? 'bg-primary text-black' : 'text-zinc-400')}>
                <User className="h-4 w-4 inline mr-1" />List
              </button>
              <button onClick={() => setView('schedule')} className={cn('rounded px-3 py-2 text-sm', view === 'schedule' ? 'bg-primary text-black' : 'text-zinc-400')}>
                <Calendar className="h-4 w-4 inline mr-1" />Schedule
              </button>
            </div>
            <Button className="bg-primary"><Plus className="h-4 w-4 mr-2" />Add Staff</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 py-4">
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Total Staff</p>
                  <p className="text-2xl font-bold text-white">{SAMPLE_STAFF.length}</p>
                </div>
                <User className="h-8 w-8 text-zinc-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">On Duty</p>
                  <p className="text-2xl font-bold text-green-500">{activeStaff}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Hours This Week</p>
                  <p className="text-2xl font-bold text-primary">{totalHours}h</p>
                </div>
                <Clock className="h-8 w-8 text-zinc-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Avg Hours/Week</p>
                  <p className="text-2xl font-bold text-white">{Math.round(totalHours / SAMPLE_STAFF.length)}h</p>
                </div>
                <Calendar className="h-8 w-8 text-zinc-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Role Filters */}
      <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 py-3 flex gap-2">
        {roles.map((role) => (
          <button key={role} onClick={() => setRoleFilter(role)} className={cn('rounded-lg px-3 py-1.5 text-sm', roleFilter === role ? 'bg-primary text-black' : 'text-zinc-400 hover:bg-zinc-800')}>
            {role}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {view === 'list' ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900">
            <table className="w-full">
              <thead className="border-b border-zinc-800">
                <tr className="text-left text-sm text-zinc-400">
                  <th className="p-4">Name</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Current Shift</th>
                  <th className="p-4">Hours/Week</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="p-4 font-medium text-white">{staff.name}</td>
                    <td className="p-4"><Badge className="bg-zinc-800">{staff.role}</Badge></td>
                    <td className="p-4">
                      <Badge className={staff.status === 'active' ? 'bg-green-500' : 'bg-zinc-600'}>
                        {staff.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-zinc-400">{staff.shift}</td>
                    <td className="p-4 text-white">{staff.hoursWeek}h</td>
                    <td className="p-4 text-zinc-400">{staff.phone}</td>
                    <td className="p-4">
                      <Button size="sm" variant="outline" className="border-zinc-700">Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-4">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <Card key={day} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-white mb-3">{day}</h3>
                  <div className="space-y-2">
                    {SHIFTS.map((shift) => (
                      <div key={shift} className="rounded bg-zinc-800 p-2">
                        <p className="text-xs text-zinc-400">{shift}</p>
                        <p className="text-sm text-white font-medium">{Math.floor(Math.random() * 3) + 1} staff</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
