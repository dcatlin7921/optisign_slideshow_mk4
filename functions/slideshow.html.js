export const onRequest = async ({ request, env, next }) => {
  const url = new URL(request.url);
  const allowedSlug = env.UNLISTED_SLUG;
  const key = url.searchParams.get('key');
  if (!allowedSlug) {
    return new Response('UNLISTED_SLUG secret is missing', { status: 500 });
  }
  if (key !== allowedSlug) {
    return new Response('Not Found', { status: 404 });
  }
  // Serve the static slideshow.html file
  return next();
};
