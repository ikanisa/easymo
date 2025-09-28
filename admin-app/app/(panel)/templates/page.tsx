import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/api/queryClient';
import { TemplatesClient } from './TemplatesClient';
import {
  templatesQueryKeys,
  fetchTemplates,
  type TemplatesQueryParams
} from '@/lib/queries/templates';
import {
  flowsQueryKeys,
  fetchFlows,
  type FlowsQueryParams
} from '@/lib/queries/flows';

const DEFAULT_TEMPLATE_PARAMS: TemplatesQueryParams = { limit: 100 };
const DEFAULT_FLOW_PARAMS: FlowsQueryParams = { limit: 100 };

export default async function TemplatesPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: templatesQueryKeys.list(DEFAULT_TEMPLATE_PARAMS),
      queryFn: () => fetchTemplates(DEFAULT_TEMPLATE_PARAMS)
    }),
    queryClient.prefetchQuery({
      queryKey: flowsQueryKeys.list(DEFAULT_FLOW_PARAMS),
      queryFn: () => fetchFlows(DEFAULT_FLOW_PARAMS)
    })
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <TemplatesClient
        initialTemplateParams={DEFAULT_TEMPLATE_PARAMS}
        initialFlowParams={DEFAULT_FLOW_PARAMS}
      />
    </HydrationBoundary>
  );
}
