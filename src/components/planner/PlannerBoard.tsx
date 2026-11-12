"use client";

import { useMemo, useState, useTransition } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { CalendarClock, Check, CheckCircle2, Circle, Lightbulb, ListTodo, Pencil, Plus, RotateCcw, Search, Trash2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import {
    deletePlannerTopic,
    savePlannerTopic,
    setPlannerCheckpointDone,
    setPlannerTopicDone,
    type PlannerTopicData,
    type PlannerTopicType,
} from "@/lib/actions/planner-actions";

const TYPES: Record<PlannerTopicType, { label: string; plural: string; icon: typeof Lightbulb; chip: string; accent: string }> = {
    IDEA: { label: "Idea", plural: "Ideas", icon: Lightbulb, chip: "bg-amber-50 text-amber-700 border-amber-200", accent: "border-t-amber-400" },
    MEETING: { label: "Meeting", plural: "Meetings", icon: Users, chip: "bg-sky-50 text-sky-700 border-sky-200", accent: "border-t-sky-400" },
    TASK: { label: "Task", plural: "Tasks", icon: ListTodo, chip: "bg-emerald-50 text-emerald-700 border-emerald-200", accent: "border-t-emerald-400" },
};

// A deadline saved without a time is stored at local midnight and treated as "that day"
const hasTime = (d: Date) => d.getHours() !== 0 || d.getMinutes() !== 0;

function deadlineInfo(iso: string | null, done: boolean) {
    if (!iso) return null;
    const d = new Date(iso);
    const days = differenceInCalendarDays(d, new Date());
    const timed = hasTime(d);
    const time = timed ? `, ${format(d, "h:mm a")}` : "";
    const overdue = timed ? d.getTime() < Date.now() : days < 0;
    let label: string;
    if (days === 0) label = `Today${time}`;
    else if (days === 1) label = `Tomorrow${time}`;
    else if (days === -1) label = `Yesterday${time}`;
    else label = `${format(d, days > -180 && days < 180 ? "d MMM" : "d MMM yyyy")}${time}`;

    const tone = done ? "neutral" : overdue ? "overdue" : days <= 2 ? "soon" : "neutral";
    return { label: overdue && !done ? `Overdue · ${label}` : label, tone };
}

const sortKey = (t: PlannerTopicData) => (t.deadline ? new Date(t.deadline).getTime() : Number.MAX_SAFE_INTEGER);

type Filter = "ALL" | PlannerTopicType;

export function PlannerBoard({ initialTopics }: { initialTopics: PlannerTopicData[] }) {
    const [topics, setTopics] = useState(initialTopics);
    const [filter, setFilter] = useState<Filter>("ALL");
    const [query, setQuery] = useState("");
    const [showDone, setShowDone] = useState(false);
    const [editing, setEditing] = useState<PlannerTopicData | "new" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return topics
            .filter(t => filter === "ALL" || t.type === filter)
            .filter(t => !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.checkpoints.some(c => c.text.toLowerCase().includes(q)))
            .sort((a, b) => sortKey(a) - sortKey(b) || b.createdAt.localeCompare(a.createdAt));
    }, [topics, filter, query]);

    const open = visible.filter(t => !t.done);
    const done = visible.filter(t => t.done);
    const overdueCount = topics.filter(t => deadlineInfo(t.deadline, t.done)?.tone === "overdue").length;

    const replace = (topic: PlannerTopicData) =>
        setTopics(list => (list.some(t => t.id === topic.id) ? list.map(t => (t.id === topic.id ? topic : t)) : [topic, ...list]));

    // Optimistic: update the card now, put it back if the server refuses
    const optimistic = async (next: PlannerTopicData, run: () => Promise<{ success: boolean; error?: string }>) => {
        const before = topics.find(t => t.id === next.id);
        replace(next);
        const result = await run();
        if (!result.success && before) {
            replace(before);
            setError(result.error || "Could not save that change.");
        }
    };

    const toggleCheckpoint = (topic: PlannerTopicData, id: string) => {
        const checkpoint = topic.checkpoints.find(c => c.id === id);
        if (!checkpoint) return;
        optimistic(
            { ...topic, checkpoints: topic.checkpoints.map(c => (c.id === id ? { ...c, done: !c.done } : c)) },
            () => setPlannerCheckpointDone(id, !checkpoint.done),
        );
    };

    const toggleDone = (topic: PlannerTopicData) =>
        optimistic({ ...topic, done: !topic.done }, () => setPlannerTopicDone(topic.id, !topic.done));

    const remove = async (topic: PlannerTopicData) => {
        if (!confirm(`Delete "${topic.title}"? This cannot be undone.`)) return;
        setTopics(list => list.filter(t => t.id !== topic.id));
        const result = await deletePlannerTopic(topic.id);
        if (!result.success) {
            replace(topic);
            setError(result.error || "Could not delete.");
        }
    };

    const filters: Filter[] = ["ALL", "IDEA", "MEETING", "TASK"];
    const countFor = (f: Filter) => topics.filter(t => !t.done && (f === "ALL" || t.type === f)).length;

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                    {filters.map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                                filter === f ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                            )}
                        >
                            {f === "ALL" ? "All" : TYPES[f].plural}
                            <span className={cn("rounded-full px-1.5 text-xs", filter === f ? "bg-white/20" : "bg-slate-100")}>{countFor(f)}</span>
                        </button>
                    ))}
                    {overdueCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
                            <CalendarClock className="h-4 w-4" /> {overdueCount} overdue
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search topics" className="pl-9" />
                    </div>
                    <Button onClick={() => setEditing("new")} className="gap-2 shrink-0">
                        <Plus className="h-4 w-4" /> New topic
                    </Button>
                </div>
            </div>

            {error && (
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {error}
                    <button onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
                </div>
            )}

            {/* Open topics */}
            {open.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <p className="font-medium text-slate-700">{topics.length === 0 ? "Your planner is empty" : "Nothing open here"}</p>
                    <p className="mt-1 text-sm text-slate-500">Add an idea, the points for your next meeting, or a task with a deadline.</p>
                    <Button onClick={() => setEditing("new")} variant="outline" className="mt-4 gap-2">
                        <Plus className="h-4 w-4" /> New topic
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {open.map(topic => (
                        <TopicCard key={topic.id} topic={topic} onToggleCheckpoint={id => toggleCheckpoint(topic, id)} onToggleDone={() => toggleDone(topic)} onEdit={() => setEditing(topic)} onDelete={() => remove(topic)} />
                    ))}
                </div>
            )}

            {/* Completed */}
            {done.length > 0 && (
                <div className="space-y-3">
                    <button onClick={() => setShowDone(s => !s)} className="text-sm font-medium text-slate-500 hover:text-slate-800">
                        {showDone ? "Hide" : "Show"} completed ({done.length})
                    </button>
                    {showDone && (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {done.map(topic => (
                                <TopicCard key={topic.id} topic={topic} onToggleCheckpoint={id => toggleCheckpoint(topic, id)} onToggleDone={() => toggleDone(topic)} onEdit={() => setEditing(topic)} onDelete={() => remove(topic)} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {editing && (
                <TopicEditor
                    topic={editing === "new" ? null : editing}
                    defaultType={filter === "ALL" ? "IDEA" : filter}
                    onClose={() => setEditing(null)}
                    onSaved={topic => { replace(topic); setEditing(null); }}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------- Card

function TopicCard({ topic, onToggleCheckpoint, onToggleDone, onEdit, onDelete }: {
    topic: PlannerTopicData;
    onToggleCheckpoint: (id: string) => void;
    onToggleDone: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const type = TYPES[topic.type] ?? TYPES.IDEA;
    const deadline = deadlineInfo(topic.deadline, topic.done);
    const total = topic.checkpoints.length;
    const completed = topic.checkpoints.filter(c => c.done).length;
    const longDescription = topic.description.length > 220 || topic.description.split("\n").length > 4;

    return (
        <div className={cn("group flex flex-col rounded-xl border border-t-4 bg-white shadow-sm transition-shadow hover:shadow-md", type.accent, topic.done && "opacity-70")}>
            {/* Title */}
            <div className="flex items-start gap-2 p-4 pb-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", type.chip)}>
                            <type.icon className="h-3 w-3" /> {type.label}
                        </span>
                        {deadline && (
                            <span className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                                deadline.tone === "overdue" ? "bg-red-50 text-red-700" : deadline.tone === "soon" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600",
                            )}>
                                <CalendarClock className="h-3 w-3" /> {deadline.label}
                            </span>
                        )}
                    </div>
                    <button onClick={onEdit} className="block text-left">
                        <h3 className={cn("text-base font-semibold leading-snug text-slate-900 break-words", topic.done && "line-through")}>{topic.title}</h3>
                    </button>
                </div>
                <div className="flex shrink-0 gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                    <button onClick={onEdit} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                    <button onClick={onDelete} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
            </div>

            {/* Checkpoints */}
            {total > 0 && (
                <div className="space-y-2 border-t border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(completed / total) * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium tabular-nums text-slate-500">{completed}/{total}</span>
                    </div>
                    <ul className="space-y-1">
                        {topic.checkpoints.map(c => (
                            <li key={c.id}>
                                <button onClick={() => onToggleCheckpoint(c.id)} className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left text-sm hover:bg-slate-50">
                                    {c.done
                                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                        : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
                                    <span className={cn("break-words", c.done ? "text-slate-400 line-through" : "text-slate-700")}>{c.text}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Description */}
            {topic.description && (
                <div className="border-t border-slate-100 px-4 py-3">
                    <p className={cn("whitespace-pre-wrap break-words text-sm text-slate-600", !expanded && longDescription && "line-clamp-4")}>{topic.description}</p>
                    {longDescription && (
                        <button onClick={() => setExpanded(e => !e)} className="mt-1 text-xs font-medium text-slate-500 hover:text-slate-800">
                            {expanded ? "Show less" : "Show more"}
                        </button>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="mt-auto flex items-center justify-between border-t border-slate-100 px-4 py-2">
                <span className="text-xs text-slate-400">Added {format(new Date(topic.createdAt), "d MMM")}</span>
                <button onClick={onToggleDone} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                    {topic.done ? <><RotateCcw className="h-3.5 w-3.5" /> Reopen</> : <><Check className="h-3.5 w-3.5" /> Mark done</>}
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- Editor

interface DraftCheckpoint { key: number; text: string; done: boolean }

let nextKey = 1;

function TopicEditor({ topic, defaultType, onClose, onSaved }: {
    topic: PlannerTopicData | null;
    defaultType: PlannerTopicType;
    onClose: () => void;
    onSaved: (topic: PlannerTopicData) => void;
}) {
    const initialDeadline = topic?.deadline ? new Date(topic.deadline) : null;
    const [title, setTitle] = useState(topic?.title ?? "");
    const [type, setType] = useState<PlannerTopicType>(topic?.type ?? defaultType);
    const [description, setDescription] = useState(topic?.description ?? "");
    const [date, setDate] = useState(initialDeadline ? format(initialDeadline, "yyyy-MM-dd") : "");
    const [time, setTime] = useState(initialDeadline && hasTime(initialDeadline) ? format(initialDeadline, "HH:mm") : "");
    const [checkpoints, setCheckpoints] = useState<DraftCheckpoint[]>(() => [
        ...(topic?.checkpoints ?? []).map(c => ({ key: nextKey++, text: c.text, done: c.done })),
        { key: nextKey++, text: "", done: false },
    ]);
    const [error, setError] = useState<string | null>(null);
    const [saving, startSaving] = useTransition();

    const updateCheckpoint = (key: number, patch: Partial<DraftCheckpoint>) =>
        setCheckpoints(list => {
            const next = list.map(c => (c.key === key ? { ...c, ...patch } : c));
            // Always keep one empty row at the end to type the next checkpoint into
            return next[next.length - 1].text.trim() ? [...next, { key: nextKey++, text: "", done: false }] : next;
        });

    const removeCheckpoint = (key: number) =>
        setCheckpoints(list => {
            const next = list.filter(c => c.key !== key);
            return next.length === 0 || next[next.length - 1].text.trim() ? [...next, { key: nextKey++, text: "", done: false }] : next;
        });

    const focusRow = (index: number) =>
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-checkpoint-row="${index}"]`)?.focus());

    const save = () => {
        setError(null);
        if (!title.trim()) { setError("Give the topic a title."); return; }
        let deadline: string | null = null;
        if (date) {
            const [y, m, d] = date.split("-").map(Number);
            const [hh, mm] = time ? time.split(":").map(Number) : [0, 0];
            deadline = new Date(y, m - 1, d, hh, mm).toISOString();
        }
        startSaving(async () => {
            const result = await savePlannerTopic({
                id: topic?.id,
                title,
                type,
                description,
                deadline,
                checkpoints: checkpoints.filter(c => c.text.trim()).map(c => ({ text: c.text.trim(), done: c.done })),
            });
            if (result.success) onSaved(result.topic);
            else setError(result.error);
        });
    };

    return (
        <Dialog open onOpenChange={o => !o && !saving && onClose()}>
            <DialogContent className="max-h-[80vh] overflow-y-auto pr-1">
                <DialogHeader>
                    <DialogTitle>{topic ? "Edit topic" : "New topic"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700" htmlFor="planner-title">Title</label>
                        <Input id="planner-title" autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Diwali offer plan, Monday team meeting" maxLength={200} />
                    </div>

                    <div className="space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">Type</span>
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.keys(TYPES) as PlannerTopicType[]).map(t => {
                                const Icon = TYPES[t].icon;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setType(t)}
                                        className={cn("flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium", type === t ? TYPES[t].chip + " ring-1 ring-current" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                                    >
                                        <Icon className="h-4 w-4" /> {TYPES[t].label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">Deadline <span className="font-normal text-slate-400">(optional)</span></span>
                        <div className="flex items-center gap-2">
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1" aria-label="Deadline date" />
                            <Input type="time" value={time} onChange={e => setTime(e.target.value)} disabled={!date} className="w-32" aria-label="Deadline time" />
                            {date && (
                                <button type="button" onClick={() => { setDate(""); setTime(""); }} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear deadline">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">Checkpoints</span>
                        <div className="space-y-1.5">
                            {checkpoints.map((c, index) => {
                                const isLast = index === checkpoints.length - 1;
                                return (
                                    <div key={c.key} className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => updateCheckpoint(c.key, { done: !c.done })}
                                            disabled={!c.text.trim()}
                                            className="shrink-0 disabled:opacity-40"
                                            aria-label={c.done ? "Mark not done" : "Mark done"}
                                        >
                                            {c.done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-slate-300" />}
                                        </button>
                                        <Input
                                            data-checkpoint-row={index}
                                            value={c.text}
                                            onChange={e => updateCheckpoint(c.key, { text: e.target.value })}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") { e.preventDefault(); focusRow(index + 1); }
                                            }}
                                            placeholder={isLast ? "Add a checkpoint, press Enter for the next" : ""}
                                            maxLength={500}
                                            className={cn("h-9", c.done && "text-slate-400 line-through")}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeCheckpoint(c.key)}
                                            className={cn("shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700", isLast && !c.text && "invisible")}
                                            aria-label="Remove checkpoint"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700" htmlFor="planner-description">Description</label>
                        <Textarea id="planner-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Notes, discussion points, decisions…" rows={5} maxLength={10000} />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? "Saving…" : topic ? "Save changes" : "Add topic"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
