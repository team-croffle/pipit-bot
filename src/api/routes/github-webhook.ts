import { container } from '@sapphire/framework';
import type { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { isDuplicateDelivery } from '../../lib/github/delivery-cache.js';
import { dispatchGithubNotification } from '../../lib/github/dispatch.js';
import { normalizeGithubEvent } from '../../lib/github/normalize-event.js';
import { getGithubNotifySettings } from '../../lib/github/settings.js';
import { verifyGithubSignature } from '../../lib/github/signature.js';
import type { ApiVariables } from '../context.js';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export function mountGithubWebhookRoutes(app: Hono<{ Variables: ApiVariables }>): void {
  app.post(
    '/webhooks/github',
    // WHY: mounted as middleware so the cap applies before the body is hashed.
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      const secret = c.get('config').githubWebhookSecret;
      // WHY: unconfigured behaves as if the route does not exist — the caller is
      // still unauthenticated here, so it learns nothing.
      if (!secret) {
        return c.json({ error: 'Not found' }, 404);
      }

      if (!c.req.header('content-type')?.includes('application/json')) {
        return c.json({ error: 'Unsupported content type' }, 400);
      }

      const rawBody = Buffer.from(await c.req.arrayBuffer());
      if (!verifyGithubSignature(rawBody, c.req.header('x-hub-signature-256'), secret)) {
        return c.json({ error: 'Invalid signature' }, 401);
      }

      if (isDuplicateDelivery(c.req.header('x-github-delivery'))) {
        return c.json({ ok: true });
      }

      const eventName = c.req.header('x-github-event');
      if (!eventName) {
        return c.json({ error: 'Missing event header' }, 400);
      }

      // WHY: answered after signature checks so a green tick in GitHub actually
      // proves the secret matches, and before the enabled gate so the hook can be
      // registered while the feature is still switched off.
      if (eventName === 'ping') {
        return c.json({ ok: true });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch {
        return c.json({ error: 'Invalid payload' }, 400);
      }

      // WHY: 200 rather than 404 — repeated non-2xx makes GitHub mark the hook as
      // failing and eventually disable it, which would break enabling it later.
      if (!getGithubNotifySettings().enabled) {
        return c.json({ ok: true });
      }

      const notification = normalizeGithubEvent(eventName, payload);
      if (!notification) {
        return c.json({ ok: true });
      }

      // WHY: GitHub times deliveries out, so the send happens after responding.
      void dispatchGithubNotification(notification).catch((error: unknown) => {
        container.logger.error('[github]', error);
      });

      return c.json({ ok: true });
    },
  );
}
