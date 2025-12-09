'use client';

/**
 * Member Card Component
 * Displays member summary information
 */

import { Badge } from '../ui/Badge';
import { formatCurrency, formatPhone, getInitials } from '@/lib/vendor-portal/utils/format';
import type { Member } from '@/lib/vendor-portal/types';

export interface MemberCardProps {
  member: Member;
  onClick?: (member: Member) => void;
  showBalance?: boolean;
}

export function MemberCard({ member, onClick, showBalance = true }: MemberCardProps) {
  const statusColors = {
    active: 'success',
    inactive: 'warning',
    suspended: 'danger',
  } as const;

  return (
    <div
      onClick={() => onClick?.(member)}
      className={`
        bg-white border border-gray-200 rounded-lg p-4 
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
          {getInitials(member.full_name)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {member.full_name}
              </h3>
              <p className="text-sm text-gray-600">
                {formatPhone(member.phone)}
              </p>
            </div>
            <Badge variant={statusColors[member.status]}>
              {member.status}
            </Badge>
          </div>

          {member.account_number && (
            <p className="text-xs text-gray-500 mt-1">
              Account: {member.account_number}
            </p>
          )}

          {showBalance && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Balance:</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(member.balance || 0)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
