'use client';

/**
 * Member Form Component
 * Reusable form for creating/editing members
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { Member } from '@/lib/vendor-portal/types';
import { validatePhone, validateRequired } from '@/lib/vendor-portal/utils/validation';

export interface MemberFormProps {
  member?: Member;
  onSubmit: (data: Partial<Member>) => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export function MemberForm({ member, onSubmit, onCancel, loading = false }: MemberFormProps) {
  const [formData, setFormData] = useState({
    full_name: member?.full_name || '',
    phone: member?.phone || '',
    national_id: member?.national_id || '',
    account_number: member?.account_number || '',
    account_type: member?.account_type || 'savings',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate full name
    const nameValidation = validateRequired(formData.full_name);
    if (!nameValidation.valid) {
      newErrors.full_name = nameValidation.error!;
    }

    // Validate phone
    const phoneReq = validateRequired(formData.phone);
    if (!phoneReq.valid) {
      newErrors.phone = phoneReq.error!;
    } else {
      const phoneValidation = validatePhone(formData.phone);
      if (!phoneValidation.valid) {
        newErrors.phone = phoneValidation.error!;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Full Name"
        value={formData.full_name}
        onChange={(e) => handleChange('full_name', e.target.value)}
        error={errors.full_name}
        required
        placeholder="John Doe"
      />

      <Input
        label="Phone Number"
        value={formData.phone}
        onChange={(e) => handleChange('phone', e.target.value)}
        error={errors.phone}
        required
        placeholder="+250 788 123 456"
        type="tel"
      />

      <Input
        label="National ID"
        value={formData.national_id}
        onChange={(e) => handleChange('national_id', e.target.value)}
        error={errors.national_id}
        placeholder="1234567890123456"
        helperText="16-digit national ID number"
      />

      <Input
        label="Account Number"
        value={formData.account_number}
        onChange={(e) => handleChange('account_number', e.target.value)}
        error={errors.account_number}
        placeholder="ACC-001"
        helperText="Optional - will be auto-generated if not provided"
      />

      <Select
        label="Account Type"
        value={formData.account_type}
        onChange={(e) => handleChange('account_type', e.target.value)}
        options={[
          { value: 'savings', label: 'Savings' },
          { value: 'loan', label: 'Loan' },
          { value: 'shares', label: 'Shares' },
        ]}
        required
      />

      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} fullWidth>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading} fullWidth>
          {member ? 'Update Member' : 'Create Member'}
        </Button>
      </div>
    </form>
  );
}
