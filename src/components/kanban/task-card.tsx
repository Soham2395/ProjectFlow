"use client";

import { CSSProperties, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type KanbanLabel = { id?: string; name: string; color: string };
export type KanbanUser = { id: string; name: string | null; email: string | null; image: string | null };
export type KanbanTask = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | Date | null;
  assignee?: KanbanUser | null;
  labels: KanbanLabel[];
  sortOrder?: number;
  createdAt?: string | Date;
};

function formatDate(d?: string | Date | null) {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

function initials(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.trim().split(" ");
    const i = parts[0]?.[0] || "";
    const j = parts[1]?.[0] || "";
    return (i + j).toUpperCase() || (email?.[0] || "?").toUpperCase();
  }
  return (email?.[0] || "?").toUpperCase();
}

function priorityColor(priority: string) {
  const p = priority.toLowerCase();
  if (p === "urgent") return "bg-red-600/15 text-red-600 border-red-600/20";
  if (p === "high") return "bg-orange-500/15 text-orange-600 border-orange-500/20";
  if (p === "medium") return "bg-amber-500/15 text-amber-600 border-amber-500/20";
  return "bg-emerald-500/15 text-emerald-600 border-emerald-500/20"; // low
}

export default function TaskCard({ task, onClick }: { task: KanbanTask; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
  };

  const due = useMemo(() => formatDate(task.dueDate), [task.dueDate]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="rounded-md border bg-card p-3 shadow-sm hover:shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium leading-tight line-clamp-2">{task.title}</div>
        <span className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityColor(task.priority)}`}>
          {task.priority[0].toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {due ? <div className="text-xs text-muted-foreground">Due {due}</div> : null}
        <div className="ml-auto flex items-center gap-1">
          {task.assignee ? (
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.assignee.image || undefined} alt={task.assignee.name || task.assignee.email || "Assignee"} />
              <AvatarFallback>{initials(task.assignee.name, task.assignee.email)}</AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      </div>

      {task.labels?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span key={l.name} className="rounded-md border px-1.5 py-0.5 text-[10px]" style={{ borderColor: l.color, color: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
