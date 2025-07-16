/**
 * Handle POST /reset requests for admin reset functionality
 */

// Rate limiting storage
const RATE_LIMIT_RESET = new Map();

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
    
    // Check rate limit (1 reset per minute per IP)
    if (!checkResetRateLimit(clientIP)) {
      return Response.json({ error: 'Rate limit exceeded. Please wait before trying again.' }, 
        { status: 429, headers: corsHeaders });
    }

    const body = await request.json();
    const token = body.token;
    
    if (!token || token !== env.ADMIN_TOKEN) {
      return Response.json({ error: 'Invalid admin token.' }, 
        { status: 401, headers: corsHeaders });
    }
    
    // Clear all guest images from queue
    const queueList = await env.PHOTO_QUEUE.list({ prefix: 'queue:' });
    const deletePromises = [];
    
    for (const item of queueList.keys) {
      const metadata = JSON.parse(await env.PHOTO_QUEUE.get(item.name));
      
      // Delete from R2 bucket
      deletePromises.push(env.PHOTO_BUCKET.delete(metadata.key));
      
      // Delete from KV queue
      deletePromises.push(env.PHOTO_QUEUE.delete(item.name));
    }
    
    await Promise.all(deletePromises);
    
    return Response.json({ 
      success: true, 
      message: 'All guest images cleared successfully.' 
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Reset error:', error);
    return Response.json({ error: 'Reset failed. Please try again.' }, 
      { status: 500, headers: corsHeaders });
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

function checkResetRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxResets = 1;

  if (!RATE_LIMIT_RESET.has(ip)) {
    RATE_LIMIT_RESET.set(ip, []);
  }

  const resets = RATE_LIMIT_RESET.get(ip);
  const recentResets = resets.filter(time => now - time < windowMs);
  
  if (recentResets.length >= maxResets) {
    return false;
  }

  recentResets.push(now);
  RATE_LIMIT_RESET.set(ip, recentResets);
  return true;
}
