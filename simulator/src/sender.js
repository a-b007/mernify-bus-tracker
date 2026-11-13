/**
 * sender.js — HTTP batch sender for telemetry events.
 *
 * Batches events and POSTs to the ingest endpoint.
 * Retries on failure with exponential backoff (max 3 attempts).
 */

const MAX_RETRIES = 3;
const MAX_BATCH_SIZE = 1000;

/**
 * Create a sender instance.
 *
 * @param {string} ingestUrl   — full URL, e.g. http://localhost:3001/api/ingest/batch
 * @param {string} apiKey      — value for x-api-key header
 * @param {number} intervalMs  — send interval (default 2000)
 */
export function createSender(ingestUrl, apiKey, intervalMs = 2000) {
  const pendingEvents = [];
  let totalSent = 0;
  let totalErrors = 0;
  let timer = null;

  function enqueue(events) {
    pendingEvents.push(...events);
  }

  async function sendBatch(events) {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      const t0 = Date.now();
      try {
        const res = await fetch(ingestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ events }),
        });
        const elapsed = Date.now() - t0;
        if (res.ok) {
          totalSent += events.length;
          console.log(
            `[sender] sent ${events.length} events (${elapsed}ms) — total ${totalSent}`
          );
          return;
        }
        console.error(
          `[sender] HTTP ${res.status} (${elapsed}ms) attempt ${attempt + 1}`
        );
      } catch (err) {
        const elapsed = Date.now() - t0;
        console.error(
          `[sender] error: ${err.message} (${elapsed}ms) attempt ${attempt + 1}`
        );
      }
      attempt++;
      totalErrors++;
      if (attempt < MAX_RETRIES) {
        const backoff = Math.pow(2, attempt) * 500;
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    console.error(`[sender] giving up on batch of ${events.length} events after ${MAX_RETRIES} attempts`);
  }

  async function flush() {
    if (pendingEvents.length === 0) return;
    // Drain up to MAX_BATCH_SIZE
    const batch = pendingEvents.splice(0, MAX_BATCH_SIZE);
    await sendBatch(batch);
  }

  function start() {
    timer = setInterval(() => {
      flush().catch((e) => console.error("[sender] flush error:", e));
    }, intervalMs);
  }

  function stop() {
    if (timer) clearInterval(timer);
  }

  function stats() {
    return { totalSent, totalErrors, pending: pendingEvents.length };
  }

  return { enqueue, flush, start, stop, stats };
}
