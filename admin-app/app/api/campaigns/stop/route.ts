export const dynamic = 'force-dynamic';
import { handleAction } from '@/lib/server/campaign-actions';
import { createHandler } from '@/app/api/withObservability';

export const POST = createHandler('admin_api.campaigns.stop', async (request: Request) => {
  return handleAction(request, 'stop');
});
