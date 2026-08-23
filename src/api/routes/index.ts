import type { RouteHandler } from '../types.js';
import { handleHealth } from './health.js';
import { handleMusicInternal } from './music-internal.js';
import { handleMusicJobs } from './music-jobs.js';

export const routes: RouteHandler[] = [handleHealth, handleMusicJobs, handleMusicInternal];
