import { z } from "zod";

// Body of /api/mobile/track-plan and /api/mobile/measurements/:id/apply-track-plan
export const TrackPlanBodySchema = z.object({
    pieces: z.array(z.object({
        label: z.string().max(200),
        length: z.number(),
        productId: z.string().nullish(),
    })).max(500),
    settings: z.object({
        stockLength: z.number().positive(),
        kerf: z.number().min(0),
        keepThreshold: z.number().min(0),
    }).partial().optional(),
    // App builds from v1.1 plan against stock; older builds get the plain plan
    withStock: z.boolean().optional(),
});
