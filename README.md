# OptiSign Photo-Slideshow

A self-service photo slideshow system for venues using Cloudflare's edge platform. Patrons can upload photos via a mobile-friendly form and see them appear on a private slideshow display with configurable privacy controls.

## Features

- **Mobile-first upload form** with real-time validation
- **Automatic image processing** (resize to ≤2160px, WebP compression)  
- **Privacy-protected slideshow** with unlisted URLs and User-Agent filtering
- **Configurable queue management** (default 20 images, FIFO)
- **Flexible display modes**: show once or rotate for 1-24 hours
- **Automatic content expiry** (7-day TTL with nightly purge)
- **Accessible UI** with ARIA labels and keyboard controls
- **Rate limiting** and abuse protection
- **Default image fallbacks** for continuous display

## Architecture

Built entirely on Cloudflare's edge platform:

- **Cloudflare Pages**: Static hosting for upload form and slideshow player
- **Cloudflare Workers**: Server-side logic, image processing, queue management  
- **R2 Object Storage**: Image storage with optional default gallery
- **Workers KV**: Fast, global queue metadata storage
- **Cloudflare Images API**: Automatic resizing and optimization
- **Cron Triggers**: Scheduled cleanup of expired content

## Project Structure

```
/
├── functions/
│   └── _worker.js          # Main Worker with all endpoints
├── public/
│   ├── index.html          # Upload form
│   ├── slideshow.html      # Slideshow player
│   └── default/            # Default images directory
└── wrangler.toml           # Cloudflare configuration
```

## Environment Variables & Secrets

### Required Secrets (set via `wrangler secret put`)

- `UNLISTED_SLUG`: Random 128-bit string protecting slideshow URL
- `ADMIN_TOKEN`: Password for emergency reset endpoint  
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (for Images API)
- `CLOUDFLARE_API_TOKEN`: API token with Images:Edit permissions
- `CLOUDFLARE_ACCOUNT_HASH`: Account hash for image delivery URLs

### Environment Variables (in `wrangler.toml`)

- `QUEUE_CAP`: Maximum guest images in queue (default: "20", "0" = unlimited)
- `UA_CHECK_ENABLED`: Enable User-Agent filtering ("true"/"false")

### Required Bindings

- `PHOTO_BUCKET`: R2 bucket for image storage
- `PHOTO_QUEUE`: KV namespace for queue management  
- `IMAGES`: Cloudflare Images API binding

## Quick Start

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler auth login
```

### 2. Create Resources

```bash
# Create R2 bucket
wrangler r2 bucket create optisign-photos

# Create KV namespace
wrangler kv:namespace create "PHOTO_QUEUE"
# Copy the ID to wrangler.toml

# Set secrets
wrangler secret put UNLISTED_SLUG
# Enter a long random string (e.g., use openssl rand -hex 16)

wrangler secret put ADMIN_TOKEN  
# Enter a secure password for admin functions

wrangler secret put CLOUDFLARE_ACCOUNT_ID
# Enter your Cloudflare account ID

wrangler secret put CLOUDFLARE_API_TOKEN
# Enter API token with Images:Edit permissions

wrangler secret put CLOUDFLARE_ACCOUNT_HASH
# Enter account hash from Images dashboard
```

### 3. Update Configuration

Edit `wrangler.toml`:
- Replace `your-kv-namespace-id` with the actual KV namespace ID
- Adjust `QUEUE_CAP` and `UA_CHECK_ENABLED` as needed

### 4. Deploy

```bash
# Deploy Pages and Worker
wrangler pages publish public/
wrangler deploy

# Test locally first
wrangler dev
```

### 5. Add Default Images

Upload images to the `public/default/` directory or directly to the R2 bucket under the `default/` prefix. Supported formats: JPG, PNG, GIF, WebP, BMP.

## API Endpoints

### Public Endpoints

- `GET /` → Upload form
- `POST /upload` → Process photo uploads
- `GET /slideshow/{slug}` → Slideshow player (privacy-gated)
- `GET /queue.json` → Current slideshow playlist (no cache)

### Admin Endpoints  

- `POST /reset?token={ADMIN_TOKEN}` → Clear all guest images (rate-limited)

## Upload Validation Rules

- **File size**: ≤30 MB
- **File type**: Must be image/* MIME type
- **Name**: ≤30 characters, required
- **Duration**: 5-30 seconds
- **Consent**: Three checkboxes required (age 18+, display consent, privacy policy)
- **Display mode**: "once" or "rotation" (1-24 hours)

## Privacy & Security

### Privacy Gates

1. **Unlisted URL**: Slideshow only accessible via `/slideshow/{UNLISTED_SLUG}`
2. **User-Agent Check**: Optionally require "OptiSigns" in User-Agent header
3. **No Public Listing**: Images never exposed in directory listings or APIs

### Rate Limiting

- **Uploads**: 5 per minute per IP address
- **Reset**: 1 per minute per IP address  

### Content Expiry

- **Rotation Window**: Images expire after chosen rotation hours (1-24h)
- **Absolute TTL**: All images deleted after 7 days maximum
- **Once Mode**: Images removed after first display
- **Nightly Purge**: Automated cleanup at 3 AM UTC

## Queue Management

### Guest Image Priority

Guest images always appear before default images in the slideshow playlist.

### FIFO Behavior

When queue reaches `QUEUE_CAP`:
1. Remove expired or shown-once images first
2. If still over capacity, remove oldest remaining images
3. New uploads are always accepted if space available

### Playlist Refresh

- Player fetches fresh `/queue.json` after each complete slideshow cycle
- Updates appear within one full rotation
- No caching to ensure real-time updates

## Accessibility Features

- **Keyboard Navigation**: Arrow keys, spacebar for controls
- **Screen Reader Support**: ARIA labels, live regions for status updates
- **High Contrast**: Respects `prefers-contrast: high`
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce`
- **Touch Targets**: All interactive elements ≥44px
- **Focus Management**: Visible focus indicators

## Troubleshooting

### Common Issues

**Upload fails with "File too large"**
- Check file size ≤30 MB
- Verify MIME type is image/*

**Slideshow shows 404**  
- Verify `UNLISTED_SLUG` is set correctly
- Check User-Agent includes "OptiSigns" (if `UA_CHECK_ENABLED=true`)
- Confirm slug in URL matches exactly

**Images not appearing**
- Check R2 bucket permissions
- Verify Cloudflare Images API token has correct permissions
- Review Worker logs for processing errors

**Default images missing**
- Ensure images are in `public/default/` directory  
- Check file extensions are supported (.jpg, .png, .gif, .webp, .bmp)
- Verify R2 bucket contains `default/` prefix objects

### Monitoring

Check Worker logs for:
- Upload processing errors
- Image storage failures  
- Queue management issues
- Purge job status

### Emergency Reset

Use the reset endpoint to clear all guest content:

```bash
curl -X POST "https://your-worker.workers.dev/reset?token=YOUR_ADMIN_TOKEN"
```

## Development

### Local Testing

```bash
wrangler dev
# Access upload form at http://localhost:8787
# Slideshow at http://localhost:8787/slideshow/YOUR_SLUG
```

### Code Structure

- **Static Assets**: Served from `public/` directory
- **Dynamic Logic**: All in `functions/_worker.js`
- **Image Processing**: Cloudflare Images API with R2 fallback
- **Queue Storage**: Workers KV for metadata, R2 for files
- **Validation**: Client-side + server-side validation
- **Error Handling**: JSON responses with descriptive messages

## License

MIT License - See LICENSE file for details.

## Support

For issues and feature requests, please check the project documentation or contact your system administrator.
