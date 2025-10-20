import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenusClient } from '@/app/(panel)/menus/MenusClient';

vi.mock('@/lib/queries/menus', () => ({
  useMenuVersionsQuery: vi.fn(() => ({
    isLoading: false,
    isFetching: false,
    data: { data: [], total: 0, hasMore: false },
  })),
  useOcrJobsQuery: vi.fn(() => ({
    isLoading: false,
    isFetching: false,
    data: { data: [], total: 0, hasMore: false },
  })),
}));

describe('MenusClient', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders and updates filters without crashing', () => {
    render(<MenusClient initialMenuParams={{ limit: 100 }} initialOcrParams={{ limit: 50 }} />);
    expect(screen.getByText('Menus & OCR')).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    // First select is menu status; second is OCR job status
    fireEvent.change(selects[0], { target: { value: 'draft' } });
    fireEvent.change(selects[1], { target: { value: 'queued' } });
    // No assertion on network; ensure no errors thrown and UI remains
    expect(screen.getByText('Menu versions')).toBeInTheDocument();
  });
});

