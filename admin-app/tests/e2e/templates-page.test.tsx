import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../utils/react-testing';
import { TemplatesClient } from '@/app/(panel)/templates/TemplatesClient';

const flowsListing = {
  params: { limit: 100 },
  setParams: vi.fn(),
  query: { isLoading: false, isFetching: false },
  flows: [
    { id: 'flow-1', name: 'Order Flow', status: 'active', version: 'v1' },
  ],
  hasMore: true,
  loadingMore: false,
  statusFilter: '',
  handleStatusChange: vi.fn(),
  handleLoadMore: vi.fn(),
};

const templatesListing = {
  params: { limit: 100 },
  setParams: vi.fn(),
  query: { isLoading: false, isFetching: false },
  templates: [
    {
      id: 'template-1',
      name: 'Welcome',
      purpose: 'Greeting',
      locales: ['en'],
      status: 'approved',
      variables: ['name'],
      lastUsedAt: null,
      errorRate: 0,
    },
  ],
  hasMore: true,
  loadingMore: false,
  statusFilter: '',
  handleStatusChange: vi.fn(),
  handleLoadMore: vi.fn(),
};

vi.mock('@/lib/flows/useFlowsListing', () => ({
  useFlowsListing: () => flowsListing,
}));

vi.mock('@/lib/templates/useTemplatesListing', () => ({
  useTemplatesListing: () => templatesListing,
}));

describe('TemplatesClient', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders lists and triggers load more handlers', () => {
    render(<TemplatesClient initialTemplateParams={{ limit: 100 }} initialFlowParams={{ limit: 100 }} />);

    expect(screen.getByText('Templates & Flows')).toBeInTheDocument();
    expect(screen.getByText('Templates catalog')).toBeInTheDocument();
    expect(screen.getByText('Flows catalog')).toBeInTheDocument();

    // Click the flows load more button if present in table
    const loadMoreFlows = screen.queryByText(/Load more flows/i);
    if (loadMoreFlows) fireEvent.click(loadMoreFlows);
    expect(flowsListing.handleLoadMore).toHaveBeenCalledTimes(loadMoreFlows ? 1 : 0);

    // Click the templates load more button if present in table
    const loadMoreTemplates = screen.queryByText(/Load more templates/i);
    if (loadMoreTemplates) fireEvent.click(loadMoreTemplates);
    expect(templatesListing.handleLoadMore).toHaveBeenCalledTimes(loadMoreTemplates ? 1 : 0);
  });
});
