import { container } from '@sapphire/framework';
import type { Hono } from 'hono';

import type { EnvConfig } from '../../lib/env.js';
import {
  GithubResponseError,
  listInstallationMembers,
  listInstallationRepositories,
} from '../../lib/github/app-client.js';
import { DEFAULT_EVENT_TEMPLATES } from '../../lib/github/default-templates.js';
import { listDeliveries } from '../../lib/github/delivery-log.js';
import { listOpenItems } from '../../lib/github/open-items.js';
import { parseItemReference, remindReference } from '../../lib/github/remind-reference.js';
import {
  getGithubNotifyLoadError,
  getGithubNotifySettings,
  parseGithubNotifySettings,
  saveGithubNotifySettings,
} from '../../lib/github/settings.js';
import { EVENT_LABELS, EVENT_VARIABLES } from '../../lib/github/template.js';
import { dashboardViewer, dashboardWrite } from '../auth/dashboard.js';
import type { ApiVariables } from '../context.js';

// Same grammar the settings use for a repository rule.
const repoName = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;

/** Reminder settings, and the lists the App installation can offer the pickers. */
export function mountGithubNotifyRoutes(
  app: Hono<{ Variables: ApiVariables }>,
  config: EnvConfig,
): void {
  // `loadError` says why the file on disk is not what is in use — a damaged file used
  // to look exactly like a fresh install, and the next save quietly overwrote it.
  app.get('/api/github-notify', dashboardViewer, (c) =>
    c.json({ ...getGithubNotifySettings(), loadError: getGithubNotifyLoadError() }),
  );

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

  // The same reminder `!remind` sends, asked for from the page. The verdict comes back
  // in the body whatever it is — a skipped reminder is an answer, not an error — and
  // is also in the recent deliveries, where the operator would look for it anyway.
  app.post('/api/github-notify/remind', dashboardViewer, dashboardWrite, async (c) => {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const repo = typeof body?.repo === 'string' ? body.repo.trim() : '';
    const number = typeof body?.number === 'number' ? body.number : Number(body?.number);
    const reference = parseItemReference(`${repo} ${number}`);
    if (!reference) {
      return c.json(
        {
          error:
            'Give a repository (owner/name, or a name alone) and a pull request or issue number',
        },
        400,
      );
    }

    return c.json(await remindReference(reference));
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

  // The number picker: open pull requests and issues of one repository. `reason`
  // follows the members route so the dashboard can explain an empty list.
  app.get('/api/github/repositories/:owner/:name/open-items', dashboardViewer, async (c) => {
    const repo = `${c.req.param('owner')}/${c.req.param('name')}`;
    if (!repoName.test(repo)) {
      return c.json({ error: 'Invalid repository name' }, 400);
    }

    const githubApp = config.githubApp;
    if (!githubApp) {
      return c.json({ available: false, items: [], truncated: false, reason: 'no-credentials' });
    }

    try {
      return c.json({ available: true, ...(await listOpenItems(githubApp, repo)) });
    } catch (error) {
      const gone =
        error instanceof GithubResponseError && (error.status === 404 || error.status === 403);
      if (!gone) {
        container.logger.warn('[github] open item list failed:', error);
      }

      return c.json({
        available: false,
        items: [],
        truncated: false,
        reason: gone ? 'not-installed' : 'request-failed',
      });
    }
  });

  // `reason` and `source` exist so the dashboard can say why the list is what it is,
  // instead of an unexplained "no accounts" for every one of three different causes.
  app.get('/api/github/members', dashboardViewer, async (c) => {
    const githubApp = config.githubApp;
    if (!githubApp) {
      return c.json({ available: false, members: [], reason: 'no-credentials' });
    }

    try {
      return c.json({ available: true, ...(await listInstallationMembers(githubApp)) });
    } catch (error) {
      container.logger.warn('[github] member list failed:', error);
      return c.json({ available: false, members: [], reason: 'request-failed' });
    }
  });
}
