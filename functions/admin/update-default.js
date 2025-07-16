/**
 * Handle POST /admin/update-default to set per-image display duration for default images
 * Expected JSON body: { key: string, durationSec: number }
 * Stores metadata in KV namespace PHOTO_DEFAULT_META keyed by the R2 object key.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { key, durationSec } = body || {};
    if (!key || typeof durationSec !== 'number' || durationSec < 0) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400, headers: cors });
    }

    // If the user sets durationSec to 10 (default), we treat it as removal of custom override.
    const DEFAULT_SEC = 10;

    if (durationSec === DEFAULT_SEC) {
      await env.PHOTO_DEFAULT_META.delete(key);
    } else {
      await env.PHOTO_DEFAULT_META.put(key, JSON.stringify({ durationSec }));
    }

    return Response.json({ success: true }, { headers: cors });
  } catch (err) {
    console.error('update-default error', err);
    return Response.json({ error: 'Server error' }, { status: 500, headers: cors });
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
