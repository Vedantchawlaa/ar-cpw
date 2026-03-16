"use client";

import { useRealtime } from '@/hooks/useRealtime';

/**
 * A headless Client Component that listens to Supabase Realtime changes
 * and refreshes the Next.js App Router automatically.
 * 
 * Usage in a Server Component:
 * <RealtimeListener tables={['Transaction', 'Lead', 'Quotation']} />
 */
export function RealtimeListener({ tables = ['Transaction'] }: { tables?: string[] }) {
  useRealtime(tables);
  return null; // This component has no UI
}
