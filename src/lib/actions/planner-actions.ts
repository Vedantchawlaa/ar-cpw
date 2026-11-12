'use server'

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import type { PlannerCheckpoint, PlannerTopic } from "@prisma/client";

// Planner: each team member's own ideas, meeting points and tasks.
// Every query is scoped to the signed-in user, so nobody sees another person's planner.

export type PlannerTopicType = "IDEA" | "MEETING" | "TASK";

export interface PlannerCheckpointData {
    id: string;
    text: string;
    done: boolean;
}

export interface PlannerTopicData {
    id: string;
    title: string;
    type: PlannerTopicType;
    description: string;
    deadline: string | null; // ISO
    done: boolean;
    createdAt: string;
    checkpoints: PlannerCheckpointData[];
}

async function currentUserId(): Promise<string | null> {
    const session = await auth();
    const user = session?.user as { id?: string; role?: string } | undefined;
    const role = user?.role;
    const id = user?.id;
    if (!id || (role !== "admin" && role !== "user")) return null;
    return id;
}

const TopicSchema = z.object({
    id: z.string().optional(),
    title: z.string().trim().min(1, "Give the topic a title").max(200),
    type: z.enum(["IDEA", "MEETING", "TASK"]),
    description: z.string().max(10000).default(""),
    deadline: z.string().datetime().nullable(),
    checkpoints: z.array(z.object({
        text: z.string().trim().max(500),
        done: z.boolean(),
    })).max(100),
});

export type PlannerTopicInput = z.input<typeof TopicSchema>;

const notSignedIn = { success: false as const, error: "Please sign in again." };

function toData(topic: PlannerTopic & { checkpoints: PlannerCheckpoint[] }): PlannerTopicData {
    return {
        id: topic.id,
        title: topic.title,
        type: topic.type as PlannerTopicType,
        description: topic.description ?? "",
        deadline: topic.deadline ? topic.deadline.toISOString() : null,
        done: topic.done,
        createdAt: topic.createdAt.toISOString(),
        checkpoints: topic.checkpoints.map(c => ({ id: c.id, text: c.text, done: c.done })),
    };
}

export async function getPlannerTopics(): Promise<PlannerTopicData[]> {
    const userId = await currentUserId();
    if (!userId) return [];
    const topics = await prisma.plannerTopic.findMany({
        where: { userId },
        include: { checkpoints: { orderBy: { position: "asc" } } },
        orderBy: { createdAt: "desc" },
    });
    return topics.map(toData);
}

export async function savePlannerTopic(input: PlannerTopicInput) {
    const userId = await currentUserId();
    if (!userId) return notSignedIn;
    const parsed = TopicSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message || "Check the details." };

    const { id, title, type, description, deadline, checkpoints } = parsed.data;
    const rows = checkpoints.filter(c => c.text).map((c, position) => ({ text: c.text, done: c.done, position }));
    const fields = { title, type, description: description.trim() || null, deadline: deadline ? new Date(deadline) : null };

    try {
        let topic;
        if (id) {
            const owned = await prisma.plannerTopic.findFirst({ where: { id, userId }, select: { id: true } });
            if (!owned) return { success: false as const, error: "This topic no longer exists." };
            // The checklist is saved as a whole: replace it with what the form holds
            topic = await prisma.$transaction(async tx => {
                await tx.plannerCheckpoint.deleteMany({ where: { topicId: id } });
                return tx.plannerTopic.update({
                    where: { id },
                    data: { ...fields, checkpoints: { create: rows } },
                    include: { checkpoints: { orderBy: { position: "asc" } } },
                });
            });
        } else {
            topic = await prisma.plannerTopic.create({
                data: { ...fields, userId, checkpoints: { create: rows } },
                include: { checkpoints: { orderBy: { position: "asc" } } },
            });
        }
        revalidatePath("/planner");
        return { success: true as const, topic: toData(topic) };
    } catch (error) {
        console.error("Saving planner topic failed:", error);
        return { success: false as const, error: "Could not save. Please try again." };
    }
}

export async function setPlannerTopicDone(id: string, done: boolean) {
    const userId = await currentUserId();
    if (!userId) return notSignedIn;
    const result = await prisma.plannerTopic.updateMany({ where: { id, userId }, data: { done } });
    if (result.count === 0) return { success: false as const, error: "This topic no longer exists." };
    revalidatePath("/planner");
    return { success: true as const };
}

export async function setPlannerCheckpointDone(id: string, done: boolean) {
    const userId = await currentUserId();
    if (!userId) return notSignedIn;
    const result = await prisma.plannerCheckpoint.updateMany({ where: { id, topic: { userId } }, data: { done } });
    if (result.count === 0) return { success: false as const, error: "This checkpoint no longer exists." };
    revalidatePath("/planner");
    return { success: true as const };
}

export async function deletePlannerTopic(id: string) {
    const userId = await currentUserId();
    if (!userId) return notSignedIn;
    await prisma.plannerTopic.deleteMany({ where: { id, userId } });
    revalidatePath("/planner");
    return { success: true as const };
}
