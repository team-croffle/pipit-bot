import type { en } from '../en';
import { common } from './common';
import { embed } from './embed';
import { features } from './features';
import { github } from './github';
import { guildEvents } from './guild-events';
import { invites } from './invites';
import { language } from './language';
import { login } from './login';
import { logs } from './logs';
import { music } from './music';
import { nav } from './nav';
import { overview } from './overview';
import { pickers } from './pickers';
import { planned } from './planned';
import { playlists } from './playlists';
import { reactionRoles } from './reaction-roles';
import { recap } from './recap';
import { settings } from './settings';
import { users } from './users';

/** 한국어. Every namespace mirrors English. */
export const ko: typeof en = {
  common,
  embed,
  features,
  github,
  guildEvents,
  invites,
  language,
  login,
  logs,
  music,
  nav,
  overview,
  pickers,
  planned,
  playlists,
  reactionRoles,
  recap,
  settings,
  users,
};
