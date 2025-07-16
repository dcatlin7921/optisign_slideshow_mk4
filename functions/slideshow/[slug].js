/**
 * Handle GET /slideshow/[slug] requests with privacy gates
 */

export async function onRequestGet(context) {
  const { request, env, params } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const slug = params.slug;
    const expectedSlug = env.UNLISTED_SLUG;
    
    console.log('Slideshow access:', {
      receivedSlug: slug,
      hasExpectedSlug: !!expectedSlug,
      envKeys: Object.keys(env || {})
    });
    
    // Check if slug matches (with better error handling)
    if (!expectedSlug) {
      console.error('UNLISTED_SLUG environment variable not found');
      return new Response('Configuration Error', { status: 500 });
    }
    
    if (slug !== expectedSlug) {
      console.log('Slug mismatch - access denied');
      return new Response('Not Found', { status: 404 });
    }
    
    // Check User-Agent if enabled (disabled by default)
    const uaCheckEnabled = env.UA_CHECK_ENABLED === 'true';
    if (uaCheckEnabled) {
      const userAgent = request.headers.get('User-Agent') || '';
      if (!userAgent.includes('OptiSigns')) {
        return new Response('Not Found', { status: 404 });
      }
    }
    
    // Serve slideshow.html from the public directory
    const slideshowResponse = await fetch(new URL('/slideshow.html', request.url));
    
    if (!slideshowResponse.ok) {
      console.error('Failed to fetch slideshow.html');
      return new Response('Slideshow not available', { status: 500 });
    }
    
    return slideshowResponse;
    
  } catch (error) {
    console.error('Slideshow error:', error);
    return new Response('Internal Server Error', { status: 500 });
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
