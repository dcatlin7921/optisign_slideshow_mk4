/**
 * Migration helper to convert old 'duration' property to 'durationSec'
 * This fixes any existing KV data that still uses the old property name
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // List all queue items
    const items = await env.PHOTO_QUEUE.list();
    let migratedCount = 0;
    let totalCount = items.keys.length;

    console.log(`Starting migration for ${totalCount} items...`);

    for (const item of items.keys) {
      try {
        const metadataStr = await env.PHOTO_QUEUE.get(item.name);
        if (!metadataStr) continue;

        const metadata = JSON.parse(metadataStr);
        
        // Check if migration is needed
        if (metadata.duration !== undefined && metadata.durationSec === undefined) {
          // Migrate duration -> durationSec
          metadata.durationSec = metadata.duration;
          delete metadata.duration;
          
          // Save updated metadata
          await env.PHOTO_QUEUE.put(item.name, JSON.stringify(metadata));
          migratedCount++;
          
          console.log(`Migrated ${item.name}: duration ${metadata.durationSec}s`);
        }
      } catch (error) {
        console.error(`Error migrating ${item.name}:`, error);
      }
    }

    return Response.json({ 
      success: true,
      message: `Migration complete: ${migratedCount}/${totalCount} items migrated`,
      migratedCount,
      totalCount
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ 
      error: 'Migration failed',
      details: error.message 
    }, { status: 500, headers: corsHeaders });
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
