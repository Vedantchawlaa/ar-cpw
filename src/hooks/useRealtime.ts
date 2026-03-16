"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function useRealtime(tables: string[]) {
  const router = useRouter();

  // Stringify the tables array so we can safely use it in the dependency array
  // without triggering an infinite loop when a new array reference is passed.
  const tablesString = JSON.stringify(tables);

  useEffect(() => {
    // Parse the tables string back to an array
    const parsedTables = JSON.parse(tablesString) as string[];

    if (!supabase) {
      console.warn('Supabase client is not initialized. Realtime updates are disabled.');
      return;
    }

    const channels = parsedTables.map((table) => {
      // Connect to the specific channel for the table
      return supabase!
        .channel(`public:${table}`)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: table },
          (payload: any) => {
            console.log(`Realtime update on ${table}:`, payload);
            // Refresh the Next.js router data when a change occurs.
            // This is ideal for App Router Server Components so they grab fresh data without full reload.
            router.refresh();
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Subscribed to realtime changes on ${table}`);
          }
        });
    });

    return () => {
      channels.forEach((channel) => {
        supabase!.removeChannel(channel);
      });
    };
  }, [tablesString, router]);
}
