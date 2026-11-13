// Coalesces router refreshes triggered by Supabase realtime events.
//
// Every changed row fires its own event, and more than one listener can be
// mounted (the global RealtimeObserver plus per-page RealtimeListeners). Without
// this, a bulk insert of N rows re-renders the page N times (x listeners) at
// once, and those parallel renders exhaust the Prisma connection pool.
// Here all events within the window collapse into one refresh.

const WINDOW_MS = 800;
let pending: ReturnType<typeof setTimeout> | null = null;

export function scheduleRefresh(refresh: () => void) {
    if (pending) return; // a refresh is already queued; it will pick up this change too
    pending = setTimeout(() => {
        pending = null;
        refresh();
    }, WINDOW_MS);
}
