import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { dataDir } from './constants.js';

export function migrateRuntimeConfigFromStreamRoot(streamRoot: string): string {
  const targetPath = join(dataDir, 'runtime-config.json');
  const legacyPath = join(streamRoot, 'runtime-config.json');

  if (existsSync(targetPath) || !existsSync(legacyPath)) {
    return targetPath;
  }

  mkdirSync(dataDir, { recursive: true });
  copyFileSync(legacyPath, targetPath);
  return targetPath;
}
