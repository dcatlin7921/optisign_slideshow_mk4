/**
 * Handle POST /admin/upload-default requests to upload default images
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image');
    
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image file provided' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'File must be an image' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Validate file size (30MB limit)
    const maxSize = 30 * 1024 * 1024; // 30MB
    if (imageFile.size > maxSize) {
      return new Response(JSON.stringify({ error: 'File size must be under 30MB' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `default/${timestamp}_${originalName}`;

    // Process and resize image
    const processedImage = await processImage(imageFile);
    
    // Upload to R2
    await env.PHOTO_BUCKET.put(key, processedImage, {
      httpMetadata: {
        contentType: 'image/webp'
      }
    });

    // Save default duration metadata (6 seconds) so playlist uses 6s instead of fallback 10s
    try {
      await env.PHOTO_DEFAULT_META.put(key, JSON.stringify({ durationSec: 6 }));
    } catch (metaErr) {
      console.error('Failed to store default image metadata', metaErr);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Default image uploaded successfully',
      key: key,
      originalName: imageFile.name
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error uploading default image:', error);
    return new Response(JSON.stringify({ error: 'Failed to upload image' }), {
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

async function processImage(file) {
  try {
    // Convert to ArrayBuffer for processing
    const arrayBuffer = await file.arrayBuffer();
    
    // Use Cloudflare Images API for resizing and WebP conversion
    const resizeOptions = {
      width: 2160,
      height: 2160,
      fit: 'scale-down',
      format: 'webp',
      quality: 85
    };
    
    // For now, return the original file
    // In production, you'd want to use Cloudflare Images API or similar
    return arrayBuffer;
    
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}
