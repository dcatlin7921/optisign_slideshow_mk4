/**
 * Handle GET /admin/queue requests for queue management
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const queueList = await env.PHOTO_QUEUE.list({ prefix: 'queue:' });
    const now = Date.now();
    const queueItems = [];

    for (const item of queueList.keys) {
      try {
        const metadata = JSON.parse(await env.PHOTO_QUEUE.get(item.name));
        
        queueItems.push({
          key: item.name,
          name: metadata.name || 'Unknown',
          durationSec: metadata.durationSec || 10,
          expires: metadata.expires,
          displayMode: metadata.displayMode,
          rotationHours: metadata.rotationHours,
          isDefault: false,
          imageUrl: await getImageUrl(metadata.key, env),
          shown: metadata.shown,
          uploaded: metadata.uploaded,
          uploadedAt: metadata.uploadedAt,
          size: metadata.size,
          isExpired: metadata.expires && metadata.expires < now
        });
      } catch (error) {
        console.error('Error parsing queue item:', item.name, error);
      }
    }

    // helper to build public URL for R2 object
function isImageFile(filename) {
  const exts = ['.jpg','.jpeg','.png','.gif','.webp','.bmp'];
  const lower = filename.toLowerCase();
  return exts.some(e=>lower.endsWith(e));
}

function getImageName(filename){
  return filename.substring(filename.lastIndexOf('/')+1).split('.')[0];
}

// helper to build public URL for R2 object
async function getImageUrl(key, env) {
  try {
    const accountHash = env.CLOUDFLARE_ACCOUNT_HASH || 'demo';
    return `https://pub-${accountHash}.r2.dev/${key}`;
  } catch {
    return '/placeholder.jpg';
  }
}

// Sort guest images by upload time (oldest first for FIFO)
    queueItems.sort((a, b) => (a.uploadedAt || 0) - (b.uploadedAt || 0));

    // If queue size below cap, append default images
    const cap = parseInt(env.QUEUE_CAP) || 20;
    if (cap === 0 || queueItems.length < cap) {
      const defaultList = await env.PHOTO_BUCKET.list({ prefix: 'default/' });
      for (const obj of defaultList.objects) {
        if (!isImageFile(obj.key)) continue;
        let durationSec = 10;
        try {
          const meta = await env.PHOTO_DEFAULT_META.get(obj.key);
          if (meta) {
            const parsed = JSON.parse(meta);
            if (typeof parsed.durationSec === 'number') durationSec = parsed.durationSec;
          }
        } catch (err) {
          console.error('Failed to load default meta for', obj.key, err);
        }
        queueItems.push({
          key: obj.key,
          name: getImageName(obj.key),
          durationSec,
          expires: null,
          displayMode: 'default',
          rotationHours: -1,
          isDefault: true,
          imageUrl: await getImageUrl(obj.key, env),
          shown: false,
          uploaded: obj.uploaded,
          uploadedAt: obj.uploaded,
          size: obj.size,
          isExpired: false
        });
      }
    }

    return new Response(JSON.stringify(queueItems), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error getting queue:', error);
    return new Response(JSON.stringify({ error: 'Failed to get queue' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
