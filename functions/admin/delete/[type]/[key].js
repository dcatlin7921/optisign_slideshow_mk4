/**
 * Handle DELETE /admin/delete/[type]/[key] requests to delete specific images
 */

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { type, key } = params;
    const decodedKey = decodeURIComponent(key);

    if (type === 'queue') {
      // Delete queue item
      const metadata = JSON.parse(await env.PHOTO_QUEUE.get(decodedKey));
      
      // Delete from R2 bucket
      if (metadata && metadata.key) {
        await env.PHOTO_BUCKET.delete(metadata.key);
      }
      
      // Delete from KV queue
      await env.PHOTO_QUEUE.delete(decodedKey);
      
    } else if (type === 'default') {
      // Delete default image from R2 bucket
      await env.PHOTO_BUCKET.delete(decodedKey);
      
    } else {
      return new Response(JSON.stringify({ error: 'Invalid delete type' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Image deleted successfully' 
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error deleting image:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete image' }), {
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
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
