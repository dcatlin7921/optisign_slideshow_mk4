/**
 * Handle GET /admin/activity requests for recent activity monitoring
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
    const recentActivity = [];
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

    for (const item of queueList.keys) {
      try {
        const metadata = JSON.parse(await env.PHOTO_QUEUE.get(item.name));
        
        // Only include items from the last 24 hours
        if (metadata.uploadedAt && metadata.uploadedAt > oneDayAgo) {
          recentActivity.push({
            key: item.name,
            name: metadata.name || 'Unknown',
            durationSec: metadata.durationSec || 10,
            expires: metadata.expires,
            displayMode: metadata.displayMode,
            shown: metadata.shown,
            uploadedAt: metadata.uploadedAt,
            size: metadata.size,
            isExpired: metadata.expires && metadata.expires < now,
            timeAgo: getTimeAgo(metadata.uploadedAt)
          });
        }
      } catch (error) {
        console.error('Error parsing activity item:', item.name, error);
      }
    }

    // Sort by upload time (newest first)
    recentActivity.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));

    return new Response(JSON.stringify(recentActivity), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error getting recent activity:', error);
    return new Response(JSON.stringify({ error: 'Failed to get recent activity' }), {
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

function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
}
