'use client';

/**
 * Groups Page
 * List and management of savings groups (Ikimina)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortalShell } from '@/components/vendor-portal/layout';
import { GroupForm } from '@/components/vendor-portal/groups/GroupForm';
import { SearchInput } from '@/components/vendor-portal/ui/SearchInput';
import { Button } from '@/components/vendor-portal/ui/Button';
import { Modal } from '@/components/vendor-portal/ui/Modal';
import { Badge } from '@/components/vendor-portal/ui/Badge';
import { formatCurrency } from '@/lib/vendor-portal/utils/format';
import type { Group } from '@/lib/vendor-portal/types';

// Mock data
const mockGroups: Group[] = [
  {
    id: 'grp-001',
    sacco_id: 'sacco-001',
    name: 'Women Savings Group',
    code: 'GRP-001',
    type: 'ASCA',
    contribution_amount: 10000,
    contribution_frequency: 'weekly',
    meeting_day: 'Monday',
    payout_rotation: [],
    settings: {},
    status: 'active',
    created_at: new Date('2024-01-10'),
    updated_at: new Date('2024-01-10'),
  },
];

export default function GroupsPage() {
  const router = useRouter();
  const [groups] = useState<Group[]>(mockGroups);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const filteredGroups = groups.filter(
    (group) =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateGroup = async (data: Partial<Group>) => {
    setIsLoading(true);
    try {
      console.log('Creating group:', data);
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupClick = (group: Group) => {
    router.push(`/vendor-portal/groups/${group.id}`);
  };

  const statusColors = {
    active: 'success',
    inactive: 'warning',
    archived: 'default',
  } as const;

  return (
    <PortalShell title="Groups (Ikimina)">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search groups..."
            />
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            Create Group
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Groups</p>
            <p className="text-2xl font-bold text-gray-900">{groups.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Active Groups</p>
            <p className="text-2xl font-bold text-green-600">
              {groups.filter(g => g.status === 'active').length}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Members</p>
            <p className="text-2xl font-bold text-gray-900">0</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGroups.length === 0 ? (
            <div className="col-span-2 text-center py-12">
              <p className="text-gray-500">No groups found</p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div
                key={group.id}
                onClick={() => handleGroupClick(group)}
                className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{group.name}</h3>
                    <p className="text-sm text-gray-600">Code: {group.code}</p>
                  </div>
                  <Badge variant={statusColors[group.status]}>
                    {group.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-semibold">{group.type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Contribution:</span>
                    <span className="font-semibold">
                      {formatCurrency(group.contribution_amount)} {group.contribution_frequency}
                    </span>
                  </div>
                  {group.meeting_day && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Meeting:</span>
                      <span className="font-semibold">{group.meeting_day}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Group"
          size="md"
        >
          <GroupForm
            onSubmit={handleCreateGroup}
            onCancel={() => setIsCreateModalOpen(false)}
            loading={isLoading}
          />
        </Modal>
      </div>
    </PortalShell>
  );
}
