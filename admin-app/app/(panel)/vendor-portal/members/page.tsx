'use client';

/**
 * Members Page
 * Full member management with list, search, and create
 */

import { useState } from 'react';
import { PortalShell } from '@/components/vendor-portal/layout';
import { MemberCard } from '@/components/vendor-portal/members/MemberCard';
import { MemberForm } from '@/components/vendor-portal/members/MemberForm';
import { SearchInput } from '@/components/vendor-portal/ui/SearchInput';
import { Button } from '@/components/vendor-portal/ui/Button';
import { Modal } from '@/components/vendor-portal/ui/Modal';
import type { Member } from '@/lib/vendor-portal/types';
import { useRouter } from 'next/navigation';

// Mock data for now - will be replaced with actual API calls
const mockMembers: Member[] = [
  {
    id: 'mem-001',
    sacco_id: 'sacco-001',
    full_name: 'Jean Baptiste',
    phone: '+250788123456',
    national_id: '1234567890123456',
    account_number: 'ACC-001',
    account_type: 'savings',
    balance: 150000,
    status: 'active',
    metadata: {},
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
  },
  {
    id: 'mem-002',
    sacco_id: 'sacco-001',
    full_name: 'Marie Claire',
    phone: '+250788456789',
    national_id: '9876543210987654',
    account_number: 'ACC-002',
    account_type: 'savings',
    balance: 85000,
    status: 'active',
    metadata: {},
    created_at: new Date('2024-01-20'),
    updated_at: new Date('2024-01-20'),
  },
];

export default function MembersPage() {
  const router = useRouter();
  const [members] = useState<Member[]>(mockMembers);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const filteredMembers = members.filter(
    (member) =>
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery) ||
      member.account_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateMember = async (data: Partial<Member>) => {
    setIsLoading(true);
    try {
      // TODO: Call API to create member
      console.log('Creating member:', data);
      // await fetch('/api/vendor-portal/members', { method: 'POST', body: JSON.stringify(data) });
      setIsCreateModalOpen(false);
      // Refresh members list
    } catch (error) {
      console.error('Failed to create member:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMemberClick = (member: Member) => {
    router.push(`/vendor-portal/members/${member.id}`);
  };

  return (
    <PortalShell title="Members">
      <div className="space-y-4">
        {/* Header with search and create button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search members by name, phone, or account..."
            />
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            Add Member
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Total Members</p>
            <p className="text-2xl font-bold text-gray-900">{members.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Active Members</p>
            <p className="text-2xl font-bold text-green-600">
              {members.filter(m => m.status === 'active').length}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Inactive Members</p>
            <p className="text-2xl font-bold text-yellow-600">
              {members.filter(m => m.status === 'inactive').length}
            </p>
          </div>
        </div>

        {/* Members List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMembers.length === 0 ? (
            <div className="col-span-2 text-center py-12">
              <p className="text-gray-500">No members found</p>
            </div>
          ) : (
            filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onClick={handleMemberClick}
                showBalance
              />
            ))
          )}
        </div>

        {/* Create Member Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Add New Member"
          size="md"
        >
          <MemberForm
            onSubmit={handleCreateMember}
            onCancel={() => setIsCreateModalOpen(false)}
            loading={isLoading}
          />
        </Modal>
      </div>
    </PortalShell>
  );
}
