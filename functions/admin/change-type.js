/**
 * POST /admin/change-type  – convert an image between default and rotation modes.
 * Expects JSON body { key: string, targetType: 'default' | 'rotation' }
 *
 * Behaviour:
 * - default -> rotation:
 *     • Copies the R2 object (key under default/) to a new path uploads/<filename>
 *     • Creates a new KV entry under PHOTO_QUEUE with rotation metadata.
 *     • Optionally deletes PHOTO_DEFAULT_META entry.
 *     • Deletes the original R2 object so it no longer appears in default list.
 * - rotation -> default:
 *     • Looks up the KV entry, fetches its metadata, removes it from PHOTO_QUEUE.
 *     • Copies the R2 object to default/<filename> (overwriting if exists).
 *     • Removes the old R2 object.
 *
 * All operations best-effort – on failure returns 500 JSON {error}.
 */
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const { key, targetType } = body || {};

    if (!key || !['default', 'rotation'].includes(targetType)) {
      return new Response(JSON.stringify({ error: 'Invalid parameters' }), { status: 400, headers: cors });
    }

    // Route based on desired type
    if (targetType === 'rotation') {
      const result = await makeRotation(key, env);
      return new Response(JSON.stringify({ success: true, queueKey: result }), { headers: cors });
    } else {
      const result = await makeDefault(key, env);
      return new Response(JSON.stringify({ success: true, defaultKey: result }), { headers: cors });
    }
  } catch (err) {
    console.error('change-type error', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: cors });
  }
}

// ---- helpers ----

async function makeRotation(defaultKey, env) {
  // defaultKey expected like "default/<file>"; ensure exists
  const obj = await env.PHOTO_BUCKET.get(defaultKey);
  if (!obj) throw new Error('Object not found in bucket');

  const filename = defaultKey.substring(defaultKey.lastIndexOf('/') + 1);
  const newKey = `uploads/${filename}`;

  // Copy object
  await env.PHOTO_BUCKET.put(newKey, obj.body, { httpMetadata: obj.httpMetadata, customMetadata: obj.customMetadata });
  // Delete original
  await env.PHOTO_BUCKET.delete(defaultKey);
  // Remove default meta override if any
  await env.PHOTO_DEFAULT_META.delete(defaultKey);

  // Build queue metadata
  const queueKey = `queue:${crypto.randomUUID()}`;
  const meta = {
    key: newKey,
    name: filename.substring(0, filename.lastIndexOf('.')),
    rotationHours: 168,
    durationSec: 10,
    displayMode: 'rotation',
    uploaded: Date.now(),
    expires: Date.now() + 168 * 60 * 60 * 1000,
    shown: false
  };
  await env.PHOTO_QUEUE.put(queueKey, JSON.stringify(meta));
  return queueKey;
}

async function makeDefault(queueKey, env) {
  // queueKey like "queue:..."
  const metaStr = await env.PHOTO_QUEUE.get(queueKey);
  if (!metaStr) throw new Error('Queue item not found');
  const meta = JSON.parse(metaStr);
  const srcKey = meta.key;

  // Fetch object
  const obj = await env.PHOTO_BUCKET.get(srcKey);
  if (!obj) throw new Error('Object missing in bucket');

  const filename = srcKey.substring(srcKey.lastIndexOf('/') + 1);
  const destKey = `default/${filename}`;

  // Copy to default path
  await env.PHOTO_BUCKET.put(destKey, obj.body, { httpMetadata: obj.httpMetadata, customMetadata: obj.customMetadata });
  // Delete original object
  await env.PHOTO_BUCKET.delete(srcKey);
  // Remove queue entry
  await env.PHOTO_QUEUE.delete(queueKey);
  // Clean any lingering meta duration overrides (they are default 10s)
  await env.PHOTO_DEFAULT_META.delete(destKey);

  return destKey;
}
