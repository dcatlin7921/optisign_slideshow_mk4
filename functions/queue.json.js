/**
 * Handle GET /queue.json requests for slideshow playlist
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  try {
    // Build playlist: guest images first, then default images
    const playlist = [];
    
    // Get guest images from KV queue
    const queueList = await env.PHOTO_QUEUE.list({ prefix: 'queue:' });
    const now = Date.now();
    
    // Process guest images
    const guestImages = [];
    for (const item of queueList.keys) {
      const metadata = JSON.parse(await env.PHOTO_QUEUE.get(item.name));
      
      // Skip expired images
      if (metadata.expires && metadata.expires < now) {
        continue;
      }
      
      // Skip "once" images that have been shown
      if (metadata.displayMode === 'once' && metadata.shown) {
        continue;
      }
      
      // Mark "once" images as shown for next time
      if (metadata.displayMode === 'once' && !metadata.shown) {
        metadata.shown = true;
        await env.PHOTO_QUEUE.put(item.name, JSON.stringify(metadata));
      }
      
      guestImages.push({
        url: await getImageUrl(metadata.key, env),
        name: metadata.name,
        durationSec: metadata.durationSec || 10,
        rotationHours: metadata.rotationHours ?? null,
        once: metadata.displayMode === 'once',
        type: 'guest'
      });
    }
    
    // Sort guest images by upload time (FIFO)
    guestImages.sort((a, b) => a.uploaded - b.uploaded);
    playlist.push(...guestImages);
    
    // Add default images if queue has space
    const queueCap = parseInt(env.QUEUE_CAP) || 20;
    if (queueCap === 0 || playlist.length < queueCap) {
      let defaultImages = await getDefaultImages(env);
      // Shuffle default images
      for (let i = defaultImages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [defaultImages[i], defaultImages[j]] = [defaultImages[j], defaultImages[i]];
      }
      // Limit to 20
      defaultImages = defaultImages.slice(0, 20);
      playlist.push(...defaultImages);
    }
    
    return Response.json(playlist, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Queue error:', error);
    return Response.json({ error: 'Failed to load queue' }, 
      { status: 500, headers: corsHeaders });
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

async function getDefaultImages(env) {
  try {
    const defaultList = await env.PHOTO_BUCKET.list({ prefix: 'default/' });
    const defaultImages = [];
    
    for (const object of defaultList.objects) {
      if (isImageFile(object.key)) {
        defaultImages.push({
          url: await getImageUrl(object.key, env),
          name: getImageName(object.key),
          durationSec: await getDefaultDuration(object.key, env),
          type: 'default'
        });
      }
    }
    
    return defaultImages;
  } catch (error) {
    console.error('Error loading default images:', error);
    return [];
  }
}

async function getImageUrl(key, env) {
  try {
    // For R2, we need to construct a public URL or use presigned URLs
    // This is a simplified version - in production you might want presigned URLs
    const accountHash = env.CLOUDFLARE_ACCOUNT_HASH || 'demo';
    return `https://pub-${accountHash}.r2.dev/${key}`;
  } catch (error) {
    console.error('Error getting image URL:', error);
    return '/placeholder.jpg'; // Fallback
  }
}

function isImageFile(filename) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}

async function getDefaultDuration(key, env) {
  try {
    const meta = await env.PHOTO_DEFAULT_META.get(key);
    if (meta) {
      const { durationSec } = JSON.parse(meta);
      if (typeof durationSec === 'number') return durationSec;
    }
  } catch {}
  return 10; // fallback
}

function getImageName(filename) {
  const baseName = filename.substring(filename.lastIndexOf('/') + 1);
  return baseName.substring(0, baseName.lastIndexOf('.')) || baseName;
}
