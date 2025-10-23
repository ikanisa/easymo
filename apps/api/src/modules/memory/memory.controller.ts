import { Body, Controller, Headers, Post } from '@nestjs/common';
import { getApiControllerBasePath } from '@easymo/commons';
import { createClient } from '@supabase/supabase-js';

function adminGuard(token: string | undefined): boolean {
  const expected = process.env.ADMIN_API_TOKEN?.trim();
  const got = token?.startsWith('Bearer ') ? token.slice(7) : token;
  return !!expected && expected === got;
}

@Controller(getApiControllerBasePath('realtime'))
export class MemoryController {
  private supabase = (() => {
    const url = process.env.SUPABASE_URL || process.env.SERVICE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
  })();

  @Post('memory/upsert')
  async upsertMemory(@Headers('authorization') auth: string | undefined, @Body() body: any) {
    if (!adminGuard(auth)) return { error: 'unauthorized' };
    if (!this.supabase) return { error: 'server_misconfigured' };
    const { user_id, key, value } = body ?? {};
    if (!user_id || !key) return { error: 'missing_params' };
    const { error } = await this.supabase.from('assistant_memory').upsert({ user_id, key, value });
    if (error) return { error: error.message };
    return { ok: true };
  }

  @Post('sessions/touch')
  async touchSession(@Headers('authorization') auth: string | undefined, @Body() body: any) {
    if (!adminGuard(auth)) return { error: 'unauthorized' };
    if (!this.supabase) return { error: 'server_misconfigured' };
    const { user_id } = body ?? {};
    if (!user_id) return { error: 'missing_params' };
    const up = await this.supabase
      .from('assistant_sessions')
      .upsert({ user_id, last_active_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (up.error) return { error: up.error.message };
    return { ok: true };
  }
}

