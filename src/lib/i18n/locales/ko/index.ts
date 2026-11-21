import type { en } from '../en/index.js';
import { notice } from './notice.js';
import { recap } from './recap.js';

/** 한국어. Every namespace mirrors English; a missing key falls back to it. */
export const ko: typeof en = { notice, recap };
