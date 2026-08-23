import { join } from 'node:path';

const here = import.meta.dirname;
export const rootDir = join(here, '..', '..');
export const srcDir = join(rootDir, 'src');
export const dataDir = join(rootDir, 'data');
