/**
 * POST /admin/resize-all
 * Batch re-encodes images stored in the PHOTO_BUCKET to WebP ≤700 KB and overwrites
 * the objects in place. Designed for small one-off migrations (≈ <50 objects).
 *
 * Security: Requires JSON body {token: ADMIN_TOKEN}
 *
 * NOTE: Uses Cloudflare Image Resizing available in Workers/Pages. Each image is
 * streamed through the built-in "cf:image" transform, eliminating the need for
 * a third-party encoder. If an image cannot be compressed under the target size
 * at the default quality, quality is progressively lowered.
 */

const TARGET_MAX_BYTES = 700 * 1024; // 700 KB
const MAX_WIDTH = 2160; // match NFR
const QUALITIES = [85, 75, 65, 55]; // fallback qualities to try

export async function onRequestPost(context) {
  const { request, env } = context;

  // Basic CORS (mirrors other admin endpoints)
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const { token, prefix = '' } = await request.json();
    if (!token || token !== env.ADMIN_TOKEN) {
      return new Response(JSON.stringify({ error: 'Invalid admin token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors }
      });
    }

    let processed = 0;
    let skipped   = 0;

    // List up to 1000 keys — plenty for current use-case (<10).
    const listResp = await env.PHOTO_BUCKET.list({ prefix, limit: 1000 });

    for (const obj of listResp.objects) {
      try {
        // Skip if already WebP and below target size
        if (obj.size <= TARGET_MAX_BYTES && obj.key.endsWith('.webp')) {
          skipped++; continue;
        }

        // Stream existing object
        const existing = await env.PHOTO_BUCKET.get(obj.key, { type: 'stream' });
        if (!existing) {
          console.warn('Object disappeared', obj.key);
          skipped++; continue;
        }

        // Attempt compression at progressive qualities until size ≤ target
        let webpArrayBuffer = null;
        for (const q of QUALITIES) {
          const cfOpts = {
            cf: { image: { width: MAX_WIDTH, fit: 'scale-down', format: 'webp', quality: q } },
            method: 'POST',
            body: existing.body,
            headers: { 'Content-Type': existing.httpMetadata?.contentType || 'image/jpeg' }
          };
          const r = await fetch('https://dummy', cfOpts);
          const buf = await r.arrayBuffer();
          if (buf.byteLength <= TARGET_MAX_BYTES || q === QUALITIES[QUALITIES.length - 1]) {
            webpArrayBuffer = buf;
            break;
          }
        }

        // Overwrite in place (retain metadata, update content type)
        await env.PHOTO_BUCKET.put(obj.key.replace(/\.[a-zA-Z0-9]+$/, '.webp'), webpArrayBuffer, {
          httpMetadata: {
            contentType: 'image/webp'
          }
        });

        // If file name changed (extension swap) optionally delete old
        if (!obj.key.endsWith('.webp')) {
          await env.PHOTO_BUCKET.delete(obj.key);
        }

        processed++;
      } catch (err) {
        console.error('Resize error for', obj.key, err);
        skipped++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed, skipped }), {
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  } catch (err) {
    console.error('Resize-all fatal', err);
    return new Response(JSON.stringify({ error: 'Resize operation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
