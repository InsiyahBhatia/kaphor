import path from 'path';

async function main() {
  // Delegate directly to the authentic S3 database recreator
  require(path.join(__dirname, '../scripts/recreate-db-from-s3.js'));
}

main().catch((err) => {
  console.error('Seed execution error:', err);
  process.exit(1);
});
