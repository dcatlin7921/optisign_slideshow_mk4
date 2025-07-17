export async function onRequest(context) {
  const { request, env, next } = context;

  // Allow CORS preflight straight through
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  // Skip auth for public admin panel HTML so it can be fetched without a token
  const url = new URL(request.url);
  if (url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin/login') {
    return next();
  }

  // Get Bearer token
  const authHeader = request.headers.get('Authorization') || '';
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
  const token = tokenMatch ? tokenMatch[1] : null;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (!token || token !== env.ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  // Forward to the actual route
  const res = await next();
  // Attach CORS headers on success path too
  Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
