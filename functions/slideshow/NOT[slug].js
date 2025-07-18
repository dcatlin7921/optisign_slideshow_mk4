/**
 * Cloudflare Pages Function to serve slideshow with slug protection
 */

export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Get the expected slug from environment
  const allowedSlug = env.UNLISTED_SLUG;
  if (!allowedSlug) {
    return new Response('UNLISTED_SLUG secret is missing', { status: 500 });
  }

  const expectedPath = `/slideshow/${allowedSlug}`;
  if (url.pathname === '/slideshow' || url.pathname === '/slideshow/') {
    return Response.redirect(`${url.origin}/slideshow/${allowedSlug}`, 302);
  }
  if (url.pathname === '/slideshow' || url.pathname === '/slideshow/') {
    return Response.redirect(`${url.origin}/slideshow/${allowedSlug}`, 302);
  }

  if (url.pathname === expectedPath) {
    if (env.UA_CHECK_ENABLED === 'true') {
      const userAgent = request.headers.get('User-Agent') || '';
      if (!userAgent.includes('OptiSigns')) {
        return new Response('Access Denied', { status: 403 });
      }
    }
    // Redirect to slideshow.html with ?key
    return Response.redirect(`${url.origin}/slideshow.html?key=${allowedSlug}`, 302);
  }

  // All other cases: 404
  return new Response('Not Found', { status: 404 });
};
