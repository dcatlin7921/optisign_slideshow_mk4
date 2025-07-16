/**
 * Handle POST /admin/purge requests to manually purge expired images
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const queueList = await env.PHOTO_QUEUE.list({ prefix: 'queue:' });
    const now = Date.now();
    let purgedCount = 0;

    // Process each queue item
    for (const item of queueList.keys) {
      try {
        const metadata = JSON.parse(await env.PHOTO_QUEUE.get(item.name));
        
        // Check if expired
        if (metadata.expires && metadata.expires < now) {
          // Delete from R2 bucket
          if (metadata.key) {
            await env.PHOTO_BUCKET.delete(metadata.key);
          }
          
          // Delete from KV queue
          await env.PHOTO_QUEUE.delete(item.name);
          purgedCount++;
        }
      } catch (error) {
        console.error('Error processing queue item for purge:', item.name, error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Purged ${purgedCount} expired images`,
      purgedCount
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error purging expired images:', error);
    return new Response(JSON.stringify({ error: 'Failed to purge expired images' }), {
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
