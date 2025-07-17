/**
 * Cloudflare Pages Function to redirect /slideshow to the allowed slideshow URL
 */

export const onRequest = async (context) => {
  const allowedSlug = 'a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8';
  const redirectUrl = new URL(`/slideshow/${allowedSlug}`, context.request.url);
  
  return Response.redirect(redirectUrl.toString(), 302);
};
