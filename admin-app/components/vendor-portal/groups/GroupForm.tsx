'use client';

/**
 * Group Form Component
 * Form for creating/editing savings groups (Ikimina)
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { Group } from '@/lib/vendor-portal/types';
import { validateRequired, validateAmount } from '@/lib/vendor-portal/utils/validation';

export interface GroupFormProps {
  group?: Group;
  onSubmit: (data: Partial<Group>) => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export function GroupForm({ group, onSubmit, onCancel, loading = false }: GroupFormProps) {
  const [formData, setFormData] = useState({
    name: group?.name || '',
    code: group?.code || '',
    type: group?.type || 'ASCA',
    contribution_amount: group?.contribution_amount?.toString() || '',
    contribution_frequency: group?.contribution_frequency || 'weekly',
    meeting_day: group?.meeting_day || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const nameValidation = validateRequired(formData.name);
    if (!nameValidation.valid) newErrors.name = nameValidation.error!;

    const codeValidation = validateRequired(formData.code);
    if (!codeValidation.valid) newErrors.code = codeValidation.error!;

    const amountValidation = validateAmount(formData.contribution_amount);
    if (!amountValidation.valid) newErrors.contribution_amount = amountValidation.error!;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    const submitData = {
      ...formData,
      contribution_amount: parseFloat(formData.contribution_amount),
    };

    await onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Group Name"
        value={formData.name}
        onChange={(e) => handleChange('name', e.target.value)}
        error={errors.name}
        required
        placeholder="Savings Group A"
      />

      <Input
        label="Group Code"
        value={formData.code}
        onChange={(e) => handleChange('code', e.target.value)}
        error={errors.code}
        required
        placeholder="GRP-001"
        helperText="Unique identifier for the group"
      />

      <Select
        label="Group Type"
        value={formData.type}
        onChange={(e) => handleChange('type', e.target.value)}
        options={[
          { value: 'ASCA', label: 'ASCA (Accumulating Savings)' },
          { value: 'ROSCA', label: 'ROSCA (Rotating Savings)' },
        ]}
        required
      />

      <Input
        label="Contribution Amount"
        type="number"
        value={formData.contribution_amount}
        onChange={(e) => handleChange('contribution_amount', e.target.value)}
        error={errors.contribution_amount}
        required
        placeholder="10000"
        helperText="Amount in RWF"
      />

      <Select
        label="Contribution Frequency"
        value={formData.contribution_frequency}
        onChange={(e) => handleChange('contribution_frequency', e.target.value)}
        options={[
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
        ]}
        required
      />

      <Input
        label="Meeting Day"
        value={formData.meeting_day}
        onChange={(e) => handleChange('meeting_day', e.target.value)}
        placeholder="Monday"
        helperText="Optional - day of the week for meetings"
      />

      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} fullWidth>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading} fullWidth>
          {group ? 'Update Group' : 'Create Group'}
        </Button>
      </div>
    </form>
  );
}
