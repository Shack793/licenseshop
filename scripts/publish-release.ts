/**
 * Publishes a new bot release for Namecheap shared hosting: copies the file
 * into local-releases/ and creates the DB record so it shows up in the
 * version history on the license page.
 *
 * This is a SECOND way to publish a release, for scripting/CI — the
 * primary way is the admin dashboard at /admin/releases, which does the
 * same thing through a browser file upload.
 *
 * Usage:
 *   npx tsx scripts/publish-release.ts --version 1.4.2 --file ./bot-v1.4.2.zip --changelog "Fixed X, added Y"
 *
 * Requires DATABASE_URL only. No R2/S3 needed.
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    out[args[i].replace(/^--/, '')] = args[i + 1];
  }
  return out;
}

async function main() {
  const { version, file, changelog } = parseArgs();
  if (!version || !file || !changelog) {
    console.error('Usage: --version <x.y.z> --file <path> --changelog "<text>"');
    process.exit(1);
  }

  const filePath = path.resolve(file);
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');

  const localDir = path.join(process.cwd(), 'local-releases');
  fs.mkdirSync(localDir, { recursive: true });
  const key = `${Date.now()}-${fileName}`;
  fs.writeFileSync(path.join(localDir, key), fileBuffer);

  console.log(`Saved ${fileName} to local-releases/${key}...`);

  // Unmark any previous "latest" release before inserting the new one.
  await prisma.release.updateMany({ data: { isLatest: false }, where: { isLatest: true } });

  await prisma.release.create({
    data: {
      version,
      changelog,
      filePath: key,
      fileSize: fileBuffer.length,
      isLatest: true,
    },
  });

  console.log(`Release v${version} published and marked latest.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
