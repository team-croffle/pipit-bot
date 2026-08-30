import { container } from '@sapphire/framework';
import type { Hono } from 'hono';

import type { EnvConfig } from '../../lib/env.js';
import {
  listInstallationMembers,
  listInstallationRepositories,
} from '../../lib/github/app-client.js';
import { DEFAULT_EVENT_TEMPLATES } from '../../lib/github/default-templates.js';
import { listDeliveries } from '../../lib/github/delivery-log.js';
import {
  getGithubNotifySettings,
  parseGithubNotifySettings,
  saveGithubNotifySettings,
} from '../../lib/github/settings.js';
import { EVENT_LABELS, EVENT_VARIABLES } from '../../lib/github/template.js';
import { dashboardViewer, dashboardWrite } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

/** Reminder settings, and the two lists the App installation can offer the pickers. */
export function mountGithubNotifyRoutes(
  app: Hono<{ Variables: ApiVariables }>,
  config: EnvConfig,
): void {
  app.get('/api/github-notify', dashboardViewer, (c) => c.json(getGithubNotifySettings()));

  app.get('/api/github-notify/deliveries', dashboardViewer, (c) =>
    c.json({ deliveries: listDeliveries() }),
  );

  // WHY served rather than duplicated in the dashboard: the wording an event falls
  // back to, and the variables it may use, are the same two tables the webhook path
  // renders from. A second copy in the SPA would drift the moment either changes.
  app.get('/api/github-notify/defaults', dashboardViewer, (c) =>
    c.json({
      templates: DEFAULT_EVENT_TEMPLATES,
      variables: EVENT_VARIABLES,
      labels: EVENT_LABELS,
    }),
  );

  app.put('/api/github-notify', dashboardViewer, dashboardWrite, async (c) => {
    try {
      const body = parseGithubNotifySettings(await c.req.json());
      return c.json(await saveGithubNotifySettings(body));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid settings';
      return c.json({ error: message }, 400);
    }
  });

  app.get('/api/github/repositories', dashboardViewer, async (c) => {
    const githubApp = config.githubApp;
    if (!githubApp) {
      return c.json({ available: false, repositories: [] });
    }

    try {
      return c.json({
        available: true,
        repositories: await listInstallationRepositories(githubApp),
      });
    } catch (error) {
      container.logger.warn('[github] repository list failed:', error);
      return c.json({ available: false, repositories: [] });
    }
  });

  app.get('/api/github/members', dashboardViewer, async (c) => {
    const githubApp = config.githubApp;
    if (!githubApp) {
      return c.json({ available: false, members: [] });
    }

    try {
      return c.json({ available: true, members: await listInstallationMembers(githubApp) });
    } catch (error) {
      container.logger.warn('[github] member list failed:', error);
      return c.json({ available: false, members: [] });
    }
  });
}
