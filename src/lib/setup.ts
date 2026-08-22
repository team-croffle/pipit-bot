process.env.NODE_ENV ??= 'development';

// oxlint-disable-next-line import/no-unassigned-import
import '@sapphire/plugin-logger/register';
import { ApplicationCommandRegistries, RegisterBehavior, container } from '@sapphire/framework';
import * as colorette from 'colorette';

import { loadEnv } from './env.js';

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

export const env = loadEnv();
container.config = env;

colorette.createColors({ useColor: true });
