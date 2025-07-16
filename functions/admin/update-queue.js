/**
 * Handle POST /admin/update-queue to update metadata for a queue photo (e.g., rotationHours)
 * Expected JSON body: { key: string, rotationHours?: number, durationSec?: number }
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
    const { key, rotationHours, durationSec } = body;
    if (!key || (typeof rotationHours !== 'number' && typeof durationSec !== 'number')) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400, headers: cors });
    }

    const raw = await env.PHOTO_QUEUE.get(key);
    if (!raw) {
      return Response.json({ error: 'Queue item not found' }, { status: 404, headers: cors });
    }

    const metadata = JSON.parse(raw);
    if (typeof rotationHours === 'number') {
      metadata.rotationHours = rotationHours;
      // Recalculate expires if in rotation mode
      if (metadata.displayMode === 'rotation') {
        metadata.expires = rotationHours === -1 ? null : Date.now() + rotationHours * 60 * 60 * 1000;
      }
    }

    if (typeof durationSec === 'number') {
      metadata.durationSec = durationSec;
    }

    await env.PHOTO_QUEUE.put(key, JSON.stringify(metadata));

    return Response.json({ success: true }, { headers: cors });
  } catch (err) {
    console.error('update-queue error', err);
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
