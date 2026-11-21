import type { en } from '../en';
import { common } from './common';
import { language } from './language';
import { login } from './login';
import { nav } from './nav';

/** 한국어. Every namespace mirrors English. */
export const ko: typeof en = { common, language, login, nav };
