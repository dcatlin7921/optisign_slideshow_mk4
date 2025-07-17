/**
 * Cloudflare Pages Function to serve slideshow with slug protection
 */

export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Get the expected slug from environment
  const allowedSlug = env.UNLISTED_SLUG;
  if (!allowedSlug) {
    return new Response(JSON.stringify({ error: 'UNLISTED_SLUG secret is missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Check if accessing root slideshow (redirect to slug)
  if (url.pathname === '/slideshow' || url.pathname === '/slideshow/') {
    return Response.redirect(`${url.origin}/slideshow/${allowedSlug}`, 302);
  }
  
  // Check if accessing with correct slug
  if (url.pathname === `/slideshow/${allowedSlug}`) {
    // Check User-Agent if enabled
    if (env.UA_CHECK_ENABLED === 'true') {
      const userAgent = request.headers.get('User-Agent') || '';
      if (!userAgent.includes('OptiSigns')) {
        return new Response('Access Denied', { status: 403 });
      }
    }
    
    // Redirect to the static slideshow.html file
    return Response.redirect(`${url.origin}/slideshow.html`, 302);
  }
  
  // Invalid slug - 404
  return new Response('Not Found', { status: 404 });
};
