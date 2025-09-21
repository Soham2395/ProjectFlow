"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { KanbanTask, KanbanUser } from "./task-card";

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export default function TaskModal({
  open,
  onOpenChange,
  projectId,
  members,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  members: KanbanUser[];
  editing: KanbanTask | null;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | "">("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [labelsText, setLabelsText] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing && editing.id) {
        setTitle(editing.title || "");
        setDescription((editing.description as any) || "");
        setAssigneeId(editing.assignee?.id || "");
        setPriority((editing.priority?.toLowerCase() as any) || "medium");
        setDueDate(
          editing.dueDate
            ? new Date(editing.dueDate as any).toISOString().slice(0, 10)
            : ""
        );
        setLabelsText((editing.labels || []).map((l) => `${l.name}:${l.color}`).join(", "));
      } else if (editing) {
        // Creating in a given status
        setTitle("");
        setDescription("");
        setAssigneeId("");
        setPriority("medium");
        setDueDate("");
        setLabelsText("");
      }
    } else {
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setPriority("medium");
      setDueDate("");
      setLabelsText("");
    }
  }, [open, editing]);

  function parseLabels(input: string) {
    // format: name:color, name2:#RRGGBB
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((pair) => {
        const [name, color] = pair.split(":").map((x) => x.trim());
        if (!name) return null as any;
        return { name, color: color || "#666" };
      })
      .filter(Boolean) as { name: string; color: string }[];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !editing) return;
    setSubmitting(true);
    try {
      const payload = {
        projectId,
        title,
        description,
        status: editing.status,
        priority,
        dueDate: dueDate || null,
        assigneeId: assigneeId || null,
        labels: parseLabels(labelsText),
      };

      if (editing.id) {
        const res = await fetch(`/api/tasks/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update task");
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create task");
      }

      await onSaved();
    } catch (err) {
      console.error(err);
      alert("Failed to save task");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !editing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-lg rounded-lg border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{editing.id ? "Edit Task" : `New Task — ${labelForStatus(editing.status)}`}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Task title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Assignee</label>
              <select
                className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email || m.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Priority</label>
              <select
                className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Due date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Labels (name:color, comma-separated)</label>
              <input
                className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                value={labelsText}
                onChange={(e) => setLabelsText(e.target.value)}
                placeholder="bug:#e11d48, backend:#2563eb"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editing.id ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function labelForStatus(status: string) {
  const s = status.toLowerCase();
  if (s === "in_progress") return "In Progress";
  if (s === "done") return "Done";
  return "Todo";
}
