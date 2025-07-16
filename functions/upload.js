/**
 * Handle POST /upload requests for photo uploads
 */

// Rate limiting storage
const RATE_LIMIT_UPLOADS = new Map();

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
    
    // Check rate limit (5 uploads per minute per IP)
    if (!checkUploadRateLimit(clientIP)) {
      return Response.json({ error: 'Rate limit exceeded. Please wait before uploading again.' }, 
        { status: 429, headers: corsHeaders });
    }

    const formData = await request.formData();
    const file = formData.get('photo');
    const firstName = formData.get('name');
    const durationSec = parseInt(formData.get('duration')) || 10;
    const displayMode = formData.get('displayMode') || 'once';
    const rotationHours = parseInt(formData.get('rotationHours')) || 1;

    // Fetch admin-configured rotation limit (-1 = unlimited, default 720)
    let rotationLimit = 720;
    try {
      const cfg = await env.PHOTO_QUEUE.get('config:rotationLimit');
      if (cfg !== null) {
        rotationLimit = parseInt(cfg);
        if (isNaN(rotationLimit)) rotationLimit = 720;
      }
    } catch (_) {
      // ignore and keep default
    }
    const ageConfirm = !!formData.get('ageConfirm');
    const displayConsent = !!formData.get('displayConsent');
    const privacyAccept = !!formData.get('privacyAccept');

    // Validate upload
    const validation = validateUpload(file, firstName, durationSec, displayMode, rotationHours, rotationLimit, ageConfirm, displayConsent, privacyAccept);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400, headers: corsHeaders });
    }

    // Process and store image
    const imageKey = await processAndStoreImage(file, env);
    
    // Add to queue
    const metadata = {
      key: imageKey,
      name: firstName.trim(),
      durationSec: durationSec,
      rotationHours: rotationHours,
      size: file.size,
      displayMode: displayMode,
      uploaded: Date.now(),
      expires: displayMode === 'rotation'
        ? (rotationHours === -1 ? null : Date.now() + (rotationHours * 60 * 60 * 1000))
        : Date.now() + (7 * 24 * 60 * 60 * 1000),
      shown: false
    };

    await addToQueue(imageKey, metadata, env);

    return Response.json({ 
      success: true, 
      message: 'Photo uploaded successfully!' 
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: 'Upload failed. Please try again.' }, 
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

function validateUpload(file, name, durationSec, displayMode, hours, maxLimit, ageConfirm, displayConsent, privacyAccept) {
  if (!file || file.size === 0) {
    return { valid: false, error: 'No file selected.' };
  }

  if (file.size > 30 * 1024 * 1024) {
    return { valid: false, error: 'File size must be 30 MB or less.' };
  }

  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Only image files are allowed.' };
  }

  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'First name is required.' };
  }

  if (name.trim().length > 30) {
    return { valid: false, error: 'First name must be 30 characters or less.' };
  }

  if (durationSec < 5 || durationSec > 30) {
    return { valid: false, error: 'Display duration must be between 5 and 30 seconds.' };
  }

  if (displayMode === 'rotation') {
    const allowed = hours === -1 || maxLimit === -1 || (hours >= 1 && hours <= maxLimit);
    if (!allowed) {
      return { valid: false, error: `Rotation hours must be -1 (forever) or between 1 and ${maxLimit === -1 ? 'unlimited' : maxLimit}.` };
    }
  }

  if (!ageConfirm) {
    return { valid: false, error: 'You must confirm you are 18 or older.' };
  }

  if (!displayConsent) {
    return { valid: false, error: 'You must consent to public display of your photo.' };
  }

  if (!privacyAccept) {
    return { valid: false, error: 'You must accept the privacy policy.' };
  }

  return { valid: true };
}

async function processAndStoreImage(file, env) {
  const imageBuffer = await file.arrayBuffer();
  const filename = file.name || 'upload.jpg';
  const timestamp = Date.now();
  const imageKey = `guest/${timestamp}-${filename}`;

  // Store in R2 bucket
  await env.PHOTO_BUCKET.put(imageKey, imageBuffer, {
    httpMetadata: {
      contentType: file.type,
    },
  });

  return imageKey;
}

async function addToQueue(imageKey, metadata, env) {
  const queueKey = `queue:${Date.now()}:${imageKey}`;
  await env.PHOTO_QUEUE.put(queueKey, JSON.stringify(metadata));
}

function checkUploadRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxUploads = 5;

  if (!RATE_LIMIT_UPLOADS.has(ip)) {
    RATE_LIMIT_UPLOADS.set(ip, []);
  }

  const uploads = RATE_LIMIT_UPLOADS.get(ip);
  const recentUploads = uploads.filter(time => now - time < windowMs);
  
  if (recentUploads.length >= maxUploads) {
    return false;
  }

  recentUploads.push(now);
  RATE_LIMIT_UPLOADS.set(ip, recentUploads);
  return true;
}
