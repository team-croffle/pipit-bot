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
import { nav } from './nav';
import { pickers } from './pickers';
import { planned } from './planned';
import { reactionRoles } from './reaction-roles';
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
  nav,
  pickers,
  planned,
  reactionRoles,
  settings,
  users,
};
