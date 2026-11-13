'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { scheduleRefresh } from '@/lib/realtime-refresh';

export function RealtimeObserver() {
    const router = useRouter();

    useEffect(() => {
        if (!supabase) {
            console.warn('Supabase client not initialized. Real-time updates disabled.');
            return;
        }

        // Subscribe to all changes in the Public schema
        const channel = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                },
                (payload) => {
                    console.log('Database change detected:', payload);
                    // Refresh the current route's data, one refresh per burst of changes
                    scheduleRefresh(() => router.refresh());
                }
            )
            .subscribe();

        return () => {
            if (supabase) {
                supabase.removeChannel(channel);
            }
        };
    }, [router]);

    return null; // This component doesn't render anything
}
