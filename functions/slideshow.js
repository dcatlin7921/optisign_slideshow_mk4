/**
 * Cloudflare Pages Function to serve slideshow with slug protection
 */

export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Get the expected slug from environment
  const allowedSlug = 'a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8';
  
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
    
    // Serve the slideshow HTML
    return env.ASSETS.fetch(new URL('/slideshow.html', request.url));
  }
  
  // Invalid slug - 404
  return new Response('Not Found', { status: 404 });
};
