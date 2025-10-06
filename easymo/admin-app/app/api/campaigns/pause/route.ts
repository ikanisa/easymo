import { handleAction } from '@/lib/server/campaign-actions';

export async function POST(request: Request) {
  return handleAction(request, 'pause');
}
