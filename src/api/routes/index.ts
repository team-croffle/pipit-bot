import type { RouteHandler } from '../types.js';
import { handleConfig } from './config.js';
import { handleDashboardStatic } from './dashboard-static.js';
import { handleHealth } from './health.js';
import { handleMe } from './me.js';
import { handleMusicInternal } from './music-internal.js';
import { handleMusicJobs } from './music-jobs.js';

export const routes: RouteHandler[] = [
  handleHealth,
  handleMe,
  handleMusicJobs,
  handleMusicInternal,
  handleDashboardStatic,
  handleConfig,
];
