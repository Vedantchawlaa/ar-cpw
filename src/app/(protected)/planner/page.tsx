import { NotebookPen } from "lucide-react";
import { getPlannerTopics } from "@/lib/actions/planner-actions";
import { PlannerBoard } from "@/components/planner/PlannerBoard";

export default async function PlannerPage() {
    const topics = await getPlannerTopics();

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 text-violet-700 rounded-lg">
                    <NotebookPen className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Planner</h1>
                    <p className="text-zinc-500 text-sm">Ideas, meeting points and tasks, with checkpoints and deadlines. Only you can see your planner.</p>
                </div>
            </div>

            <PlannerBoard initialTopics={topics} />
        </div>
    );
}
