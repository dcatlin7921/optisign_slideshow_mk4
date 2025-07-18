/**
 * POST /admin/login - authenticate admin and return bearer token
 * Accepts JSON { username, password }
 * Returns { token } on success or 401 on failure
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { username, password } = body || {};

    // Debug: Log received username (never log password)
    console.log('[LOGIN] Attempt with username:', username);

    // Determine which mode is being attempted
    let authMode = null;
    if (env.ADMIN_USERNAME && env.ADMIN_PASSWORD && username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
      authMode = 'user+pass';
    } else if (env.ADMIN_PASSWORD && password === env.ADMIN_PASSWORD) {
      authMode = 'token-only';
    }

    const valid = !!authMode;
    console.log('[LOGIN] Auth mode:', authMode || 'invalid');

    if (!valid) {
      // Log failure reason for debugging
      if (!env.ADMIN_PASSWORD) {
        console.warn('[LOGIN] ADMIN_PASSWORD not set in env');
      } else if (env.ADMIN_USERNAME && env.ADMIN_PASSWORD) {
        if (username !== env.ADMIN_USERNAME) {
          console.warn('[LOGIN] Invalid username:', username);
        } else {
          console.warn('[LOGIN] Invalid password for user:', username);
        }
      } else {
        console.warn('[LOGIN] Invalid password (token-only mode)');
      }
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Return the token defined in env. If not set, generate a short-lived random one (not persisted)
    const token = env.ADMIN_TOKEN || crypto.randomUUID();
    console.log('[LOGIN] Success for username:', username, 'mode:', authMode);

    return new Response(JSON.stringify({ token }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('Login error', err);
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
