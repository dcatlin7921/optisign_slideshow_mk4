/**
 * Handle POST /admin/clear-queue requests to clear the entire queue
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Get all queue items
    const queueList = await env.PHOTO_QUEUE.list({ prefix: 'queue:' });
    
    // Delete each queue item and its corresponding R2 object
    for (const item of queueList.keys) {
      try {
        const metadata = JSON.parse(await env.PHOTO_QUEUE.get(item.name));
        
        // Delete from R2 bucket
        if (metadata.key) {
          await env.PHOTO_BUCKET.delete(metadata.key);
        }
        
        // Delete from KV queue
        await env.PHOTO_QUEUE.delete(item.name);
      } catch (error) {
        console.error('Error deleting queue item:', item.name, error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Queue cleared successfully',
      deletedCount: queueList.keys.length
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error clearing queue:', error);
    return new Response(JSON.stringify({ error: 'Failed to clear queue' }), {
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
