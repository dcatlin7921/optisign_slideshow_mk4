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
    // Build playlist: display-once images ➜ rotation images (shuffled) ➜ default images
    const playlist = [];

    // Retrieve guest images stored in KV under "queue:*"
    const queueList = await env.PHOTO_QUEUE.list({ prefix: 'queue:' });
    const now = Date.now();

    // Temporary buckets
    const onceImages = [];
    const rotationImages = [];

    for (const item of queueList.keys) {
      const metadata = JSON.parse(await env.PHOTO_QUEUE.get(item.name));

      // Skip expired images
      if (metadata.expires && metadata.expires < now) {
        continue;
      }

      // Skip display-once images that have already been shown
      if (metadata.displayMode === 'once' && metadata.shown) {
        continue;
      }

      // Mark display-once images as shown so they are skipped on next playlist build
      if (metadata.displayMode === 'once' && !metadata.shown) {
        metadata.shown = true;
        await env.PHOTO_QUEUE.put(item.name, JSON.stringify(metadata));
      }

      const img = {
        url: await getImageUrl(metadata.key, env),
        name: metadata.name,
        durationSec: metadata.durationSec || 10,
        rotationHours: metadata.rotationHours ?? null,
        once: metadata.displayMode === 'once',
        type: 'guest',
        uploaded: metadata.uploaded ?? metadata.timestamp ?? now // used for ordering
      };

      if (metadata.displayMode === 'once') {
        onceImages.push(img);
      } else {
        // treat any non-once guest image as rotation image
        rotationImages.push(img);
      }
    }

    // Order display-once images FIFO (oldest first)
    onceImages.sort((a, b) => a.uploaded - b.uploaded);

    // Shuffle rotationImages
    for (let i = rotationImages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rotationImages[i], rotationImages[j]] = [rotationImages[j], rotationImages[i]];
    }

    playlist.push(...onceImages, ...rotationImages);

    // Append up to 20 random default images
    let defaultImages = await getDefaultImages(env);

    // Shuffle defaultImages (Fisher-Yates)
    for (let i = defaultImages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [defaultImages[i], defaultImages[j]] = [defaultImages[j], defaultImages[i]];
    }

    defaultImages = defaultImages.slice(0, 20);
    playlist.push(...defaultImages);
    
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
    // Ensure R2_PUBLIC_URL is set in wrangler.toml
    if (!env.R2_PUBLIC_URL || env.R2_PUBLIC_URL.includes('<YOUR_ACCOUNT_HASH>')) {
        console.error('R2_PUBLIC_URL is not configured in wrangler.toml');
        return '/placeholder.jpg'; // Fallback to prevent broken image icons
    }
    
    // Remove trailing slash if present, then append the key
    const baseUrl = env.R2_PUBLIC_URL.endsWith('/') ? env.R2_PUBLIC_URL.slice(0, -1) : env.R2_PUBLIC_URL;
    return `${baseUrl}/${key}`;

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
