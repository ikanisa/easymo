import { Body, Controller, Post } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { getApiControllerBasePath } from '@easymo/commons';

type SuggestPayload = {
  text: string;
  region?: string;
  limit?: number;
  user_id?: string;
};

export function classify(text: string) {
  const t = text.toLowerCase();
  if (/(pharmacy|medic|health|clinic|hospital)/.test(t)) return 'pharmacy';
  if (/(bar|drink|beer|wine|pub)/.test(t)) return 'bar';
  if (/(music|live)/.test(t)) return 'live-music';
  return 'general';
}

@Controller(getApiControllerBasePath('realtime'))
export class SuggestionsController {
  private supabase = (() => {
    const url = process.env.SUPABASE_URL || process.env.SERVICE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
  })();

  @Post('suggestions/search')
  async search(@Body() body: SuggestPayload) {
    if (!this.supabase) return { items: [], error: 'server_misconfigured' };
    const text = (body?.text ?? '').trim();
    const limit = Math.max(1, Math.min(20, Number(body?.limit ?? 5)));
    if (!text) return { items: [] };
    const category = classify(text);

    // Resolve region from memory if user_id provided and region not in payload
    let region = (body?.region ?? '').trim();
    if (!region && body?.user_id) {
      const { data: mem } = await this.supabase
        .from('assistant_memory')
        .select('value')
        .eq('user_id', body.user_id)
        .in('key', ['region', 'home_region'])
        .order('updated_at', { ascending: false })
        .limit(1);
      const val = Array.isArray(mem) && mem.length ? (mem[0] as any).value : null;
      if (val && typeof val === 'object' && typeof val.region === 'string') {
        region = val.region;
      }
    }

    let query = this.supabase.from('businesses').select('*').limit(limit);
    if (category === 'pharmacy') query = query.eq('category', 'pharmacy');
    if (category === 'bar') query = query.eq('category', 'bar');
    if (region) query = query.ilike('region', `%${region}%`);
    // fallback: fuzzy name search
    if (category === 'general') query = query.ilike('name', `%${text.split(' ')[0]}%`);
    const { data, error } = await query;
    if (error) return { items: [], error: error.message };
    return { items: data ?? [] };
  }
}
