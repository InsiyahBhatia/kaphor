import path from 'path';
import fs from 'fs';
import db from '../src/lib/prisma';
import { logger } from '../src/lib/logger';

/**
 * Maintenance script to identify and prune orphaned image files
 * that are no longer referenced by any active or archived garment.
 */
async function pruneOrphanedImages(dryRun: boolean = true) {
  logger.info(`Starting orphaned image audit (dryRun=${dryRun})...`);

  // 1. Gather all active referenced images across garments
  const garments = await db.garment.findMany({
    select: { id: true, images: true, title: true, isActive: true },
  });

  const activeReferenced = new Set<string>();
  const allGarmentImageKeys = new Set<string>();

  for (const g of garments) {
    for (const img of g.images || []) {
      allGarmentImageKeys.add(img);
      if (g.isActive) {
        activeReferenced.add(img);
      }
    }
  }

  logger.info(`Found ${garments.length} garments with ${allGarmentImageKeys.size} distinct image references (${activeReferenced.size} on active listings).`);

  // 2. Scan local uploads directory (for local fallback files)
  const uploadsDir = path.join(__dirname, '../uploads');
  let localFilesScanned = 0;
  let localOrphansFound = 0;

  function scanFolder(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanFolder(fullPath);
      } else {
        localFilesScanned++;
        const relativeToUploads = path.relative(uploadsDir, fullPath).replace(/\\/g, '/');
        
        // Check if referenced by any garment
        const isReferenced = Array.from(allGarmentImageKeys).some(key => 
          key.includes(relativeToUploads) || key.includes(entry.name)
        );

        if (!isReferenced) {
          localOrphansFound++;
          logger.info(`[ORPHAN LOCAL] Found unreferenced file: ${relativeToUploads}`);
          if (!dryRun) {
            try {
              fs.unlinkSync(fullPath);
              logger.info(`[PRUNED LOCAL] Deleted: ${relativeToUploads}`);
            } catch (err: any) {
              logger.error(`Failed to delete local orphan: ${relativeToUploads}`, { error: err.message });
            }
          }
        }
      }
    }
  }

  if (fs.existsSync(uploadsDir)) {
    scanFolder(uploadsDir);
  }

  logger.info(`Scan complete: ${localFilesScanned} local files scanned, ${localOrphansFound} orphaned files ${dryRun ? 'detected (dry-run)' : 'pruned'}.`);
}

// Run if called directly
if (require.main === module) {
  const isDryRun = !process.argv.includes('--execute');
  pruneOrphanedImages(isDryRun)
    .then(() => {
      logger.info('Orphaned image audit finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Orphaned image audit failed', { error: err });
      process.exit(1);
    });
}
