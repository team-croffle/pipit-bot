const RETENTION_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

const deliveries = new Map<string, number>();

function prune(now: number): void {
  for (const [id, seenAt] of deliveries) {
    if (now - seenAt > RETENTION_MS) {
      deliveries.delete(id);
    }
  }

  while (deliveries.size > MAX_ENTRIES) {
    const oldest = deliveries.keys().next();
    if (oldest.done) {
      break;
    }

    deliveries.delete(oldest.value);
  }
}

/**
 * Guards against replay: a captured delivery stays signature-valid forever, so the
 * same `X-GitHub-Delivery` must only ever be acted on once. In-memory only — a
 * restart at worst allows one duplicate message.
 */
export function isDuplicateDelivery(deliveryId: string | undefined): boolean {
  if (!deliveryId) {
    return false;
  }

  const now = Date.now();
  prune(now);

  if (deliveries.has(deliveryId)) {
    return true;
  }

  deliveries.set(deliveryId, now);
  return false;
}
