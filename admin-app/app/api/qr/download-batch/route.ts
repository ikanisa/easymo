export const dynamic = 'force-dynamic';
import JSZip from 'jszip';
import { z } from 'zod';

import { createHandler } from '@/app/api/withObservability';
import { jsonError, zodValidationError } from '@/lib/api/http';
import { requireActorId, UnauthorizedError } from '@/lib/server/auth';
import { logStructured } from '@/lib/server/logger';
import { getSupabaseAdminClient } from '@/lib/server/supabase-admin';

const requestSchema = z.object({
  tokenIds: z.array(z.string().uuid()).min(1).max(100),
  format: z.enum(['png', 'svg']).default('png'),
});

export const POST = createHandler('admin_api.qr.download_batch', async (request: Request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric('qr_download_batch.supabase_unavailable', 1);
    return jsonError({ error: 'supabase_unavailable', message: 'Supabase unavailable' }, 503);
  }

  let actor: string;
  try {
    actor = requireActorId();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return jsonError({ error: 'unauthorized', message: err.message }, 401);
    }
    throw err;
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    recordMetric('qr_download_batch.invalid_payload', 1);
    return zodValidationError(error);
  }

  const { data: tokens, error: fetchError } = await adminClient
    .from('qr_tokens')
    .select('id, token, table_label, qr_image_url, whatsapp_deep_link, stations!inner(name)')
    .in('id', payload.tokenIds);

  if (fetchError || !tokens || tokens.length === 0) {
    recordMetric('qr_download_batch.fetch_failed', 1);
    return jsonError({ error: 'tokens_not_found', message: 'QR tokens not found' }, 404);
  }

  const zip = new JSZip();
  const barName = (tokens[0] as any).stations?.name || 'Bar';
  const folderName = `${barName.replace(/[^a-z0-9]/gi, '_')}_QR_Codes`;
  const folder = zip.folder(folderName);

  if (!folder) {
    return jsonError({ error: 'zip_creation_failed', message: 'Failed to create ZIP folder' }, 500);
  }

  let addedCount = 0;

  for (const token of tokens) {
    if (!token.qr_image_url) continue;

    try {
      const base64Data = token.qr_image_url.split(',')[1];
      if (!base64Data) continue;

      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${token.table_label.replace(/[^a-z0-9]/gi, '_')}.png`;
      
      folder.file(filename, buffer);
      folder.file(
        `${token.table_label.replace(/[^a-z0-9]/gi, '_')}_metadata.json`,
        JSON.stringify({
          table: token.table_label,
          token: token.token,
          whatsappLink: token.whatsapp_deep_link,
          generatedAt: new Date().toISOString(),
        }, null, 2)
      );
      
      addedCount++;
    } catch (error) {
      logStructured({
        event: 'qr_download_image_error',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (addedCount === 0) {
    return jsonError({ error: 'no_images_available', message: 'No QR images available' }, 400);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  recordMetric('qr_download_batch.success', 1, { count: addedCount });

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${folderName}.zip"`,
      'Content-Length': zipBuffer.length.toString(),
    },
  });
});

export const runtime = 'nodejs';
