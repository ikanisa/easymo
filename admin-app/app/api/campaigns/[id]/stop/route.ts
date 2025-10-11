import { z } from 'zod';
import { handleAction } from '@/lib/server/campaign-actions';
import { jsonError } from '@/lib/api/http';
import { createHandler } from '@/app/api/withObservability';

const paramsSchema = z.object({ id: z.string().uuid() });

export const dynamic = 'force-dynamic';

export const POST = createHandler('admin_api.campaigns.id.stop', async (
  request: Request,
  context: { params: { id: string } }
) => {
  const parsed = paramsSchema.safeParse(context.params);
  if (!parsed.success) {
    return jsonError({ error: 'invalid_campaign_id', message: 'Invalid campaign ID.' }, 400);
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');

  const proxyRequest = new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ campaignId: parsed.data.id })
  });

  return handleAction(proxyRequest, 'stop');
});
