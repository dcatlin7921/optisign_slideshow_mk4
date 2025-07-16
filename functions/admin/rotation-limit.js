/**
 * Handle GET and POST /admin/rotation-limit requests to manage rotationHours cap
 * Stores limit in KV under key 'config:rotationLimit'. Value '-1' means unlimited.
 */

export async function onRequestGet(context) {
  const { env } = context;
  const limit = await env.PHOTO_QUEUE.get('config:rotationLimit');
  const value = limit === null ? 720 : parseInt(limit);
  return Response.json({ limit: value }, {
    headers: corsHeaders('GET')
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { limit } = await request.json();
    if (typeof limit !== 'number' || (limit !== -1 && (limit < 1 || limit > 8760))) {
      return Response.json({ error: 'Invalid limit. Provide -1 for unlimited or between 1 and 8760.' }, { status: 400, headers: corsHeaders('POST') });
    }
    await env.PHOTO_QUEUE.put('config:rotationLimit', limit.toString());
    return Response.json({ success: true, limit }, { headers: corsHeaders('POST') });
  } catch (error) {
    console.error('Rotation limit update error', error);
    return Response.json({ error: 'Failed to update limit' }, { status: 500, headers: corsHeaders('POST') });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders('OPTIONS') });
}

function corsHeaders(method) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}
