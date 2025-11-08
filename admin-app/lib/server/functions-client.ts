import "server-only";

export function getFunctionsBaseUrl(): string | null {
  const base = process.env.SUPABASE_FUNCTIONS_URL
    || (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1` : null)
    || (process.env.SERVICE_URL ? `${process.env.SERVICE_URL.replace(/\/$/, '')}/functions/v1` : null)
    || (process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/functions/v1` : null);
  return base ?? null;
}

export function getAdminToken(): string | null {
  return process.env.VITE_ADMIN_TOKEN
    || process.env.ADMIN_TOKEN
    || process.env.EASYMO_ADMIN_TOKEN
    || null;
}

export async function callAdminFunction<T = unknown>(name: string, init?: RequestInit): Promise<T> {
  const base = getFunctionsBaseUrl();
  const token = getAdminToken();
  if (!base || !token) {
    throw new Error('functions_base_or_admin_token_missing');
  }
  const url = `${base}/${name}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': token,
      ...(init?.headers as Record<string,string> | undefined),
    },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`function_${name}_http_${res.status}`);
  }
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return { raw: text } as unknown as T;
  }
}

