/**
 * Handle GET /admin/defaults requests for default images management
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const defaultList = await env.PHOTO_BUCKET.list({ prefix: 'default/' });
    const defaultImages = [];

    for (const object of defaultList.objects) {
      if (isImageFile(object.key)) {
        let durationSec = 10;
        try {
          const meta = await env.PHOTO_DEFAULT_META.get(object.key);
          if (meta) {
            const parsed = JSON.parse(meta);
            if (typeof parsed.durationSec === 'number') {
              durationSec = parsed.durationSec;
            }
          }
        } catch (err) {
          console.error('Failed to load default meta for', object.key, err);
        }
        defaultImages.push({
          key: object.key,
          name: getImageName(object.key),
          size: object.size,
          uploaded: object.uploaded,
          durationSec
        });
      }
    }

    // Sort by name
    defaultImages.sort((a, b) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify(defaultImages), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error getting default images:', error);
    return new Response(JSON.stringify({ error: 'Failed to get default images' }), {
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

function isImageFile(filename) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

function getImageName(filename) {
  return filename.split('/').pop().split('.')[0];
}
