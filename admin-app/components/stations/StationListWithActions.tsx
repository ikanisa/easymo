'use client';

import { useState } from 'react';
import type { Station } from '@/lib/schemas';
import { StationForm } from './StationForm';
import styles from './StationListWithActions.module.css';
import { useToast } from '@/components/ui/ToastProvider';

interface StationListWithActionsProps {
  stations: Station[];
}

export function StationListWithActions({ stations }: StationListWithActionsProps) {
  const [items, setItems] = useState(stations);
  const [isProcessing, setIsProcessing] = useState(false);
  const { pushToast } = useToast();

  const refresh = async () => {
    const response = await fetch('/api/stations', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      setItems(data.data || []);
    }
  };

  const updateStatus = async (id: string, status: 'active' | 'inactive') => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/stations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        const data = await response.json();
        pushToast(data?.error ?? 'Failed to update station.', 'error');
      } else {
        pushToast('Station updated.', 'success');
        refresh();
      }
    } catch (error) {
      console.error('Station update failed', error);
      pushToast('Unexpected error while updating station.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeStation = async (id: string) => {
    if (!confirm('Delete this station?')) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/stations/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        pushToast(data?.error ?? 'Failed to delete station.', 'error');
      } else {
        pushToast('Station deleted.', 'success');
        refresh();
      }
    } catch (error) {
      console.error('Station delete failed', error);
      pushToast('Unexpected error while deleting station.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <StationForm onCreated={refresh} />
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Engen code</th>
            <th>Owner contact</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((station) => (
            <tr key={station.id}>
              <td>{station.name}</td>
              <td>{station.engencode}</td>
              <td>{station.ownerContact ?? '—'}</td>
              <td>{station.status}</td>
              <td>
                <button
                  type="button"
                  onClick={() => updateStatus(station.id, station.status === 'active' ? 'inactive' : 'active')}
                  disabled={isProcessing}
                >
                  {station.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" onClick={() => removeStation(station.id)} disabled={isProcessing}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
