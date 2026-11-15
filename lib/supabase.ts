import {createClient} from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const signInTimeoutMs = 12000;

const fetchWithSignInTimeout: typeof fetch = async (input, init) => {
  const target = new URL(input instanceof Request ? input.url : input);
  if (!target.pathname.endsWith('/auth/v1/token') || target.searchParams.get('grant_type') !== 'password') {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const upstream = init?.signal ?? (input instanceof Request ? input.signal : null);
  const abort = () => controller.abort(upstream?.reason);
  if (upstream?.aborted) abort();
  else upstream?.addEventListener('abort', abort, {once: true});
  const timeout = setTimeout(() => controller.abort(), signInTimeoutMs);
  try {
    return await fetch(input, {...init, signal: controller.signal});
  } finally {
    clearTimeout(timeout);
    upstream?.removeEventListener('abort', abort);
  }
};

export const supabase = url && key ? createClient(url, key, {
  global: {fetch: fetchWithSignInTimeout},
}) : null;
