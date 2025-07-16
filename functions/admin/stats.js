/**
 * Handle GET /admin/stats requests for system statistics
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Get queue statistics
    const queueList = await env.PHOTO_QUEUE.list({ prefix: 'queue:' });
    const queueCount = queueList.keys.length;

    // Get default images statistics
    const defaultList = await env.PHOTO_BUCKET.list({ prefix: 'default/' });
    const defaultCount = defaultList.objects.filter(obj => isImageFile(obj.key)).length;

    // Calculate total storage size
    let totalSize = 0;
    const allObjects = await env.PHOTO_BUCKET.list();
    for (const obj of allObjects.objects) {
      totalSize += obj.size || 0;
    }

    const stats = {
      queueCount,
      defaultCount,
      totalSize,
      lastUpdated: new Date().toISOString()
    };

    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error getting admin stats:', error);
    return new Response(JSON.stringify({ error: 'Failed to get statistics' }), {
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
