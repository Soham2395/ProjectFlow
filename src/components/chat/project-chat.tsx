"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";

type Sender = {
  id: string;
  name: string | null;
  image?: string | null;
};

export type ChatMessage = {
  id: string;
  projectId: string;
  senderId: string;
  sender?: Sender;
  content?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  createdAt: string | Date;
};

type Props = {
  projectId: string;
  currentUser: Sender & { id: string };
};

export default function ProjectChat({ projectId, currentUser }: Props) {
  const socket = useMemo(() => getSocket(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!projectId) return;

    socket.emit("joinRoom", projectId);

    const onHistory = (msgs: ChatMessage[]) => {
      setMessages(msgs);
      scrollToBottom();
    };
    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    };
    const onTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers((prev) => ({ ...prev, [userId]: isTyping }));
    };

    socket.on("history", onHistory);
    socket.on("message", onMessage);
    socket.on("typing", onTyping);

    return () => {
      socket.off("history", onHistory);
      socket.off("message", onMessage);
      socket.off("typing", onTyping);
    };
  }, [projectId, socket]);

  function groupByDate(msgs: ChatMessage[]) {
    const map = new Map<string, ChatMessage[]>();
    for (const m of msgs) {
      const d = new Date(m.createdAt);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }

  function formatTime(ts: string | Date) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) return;
    socket.emit("sendMessage", {
      projectId,
      senderId: currentUser.id,
      content: trimmed,
    });
    setInput("");
    setIsTyping(false);
    socket.emit("typing", { projectId, userId: currentUser.id, isTyping: false });
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      form.append("folder", `project-${projectId}`);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      socket.emit("sendMessage", {
        projectId,
        senderId: currentUser.id,
        fileUrl: data.url,
        fileType: data.fileType,
      });
    } catch (err) {
      console.error(err);
      alert("File upload failed");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { projectId, userId: currentUser.id, isTyping: true });
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing", { projectId, userId: currentUser.id, isTyping: false });
    }, 1200);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const groups = groupByDate(messages);
  const typingText = Object.entries(typingUsers)
    .filter(([id, v]) => v && id !== currentUser.id)
    .map(([id]) => id)
    .slice(0, 3);

  function initials(name?: string | null) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase() || name[0]?.toUpperCase() || "?";
  }

  return (
    <div className="flex h-full w-full flex-col rounded-md border bg-background">
      <div className="border-b p-3">
        <h3 className="text-sm font-medium">Project Chat</h3>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-6">
        {groups.map((g) => (
          <div key={g.date} className="space-y-2">
            <div className="text-center text-xs text-muted-foreground">
              {g.date}
            </div>
            {g.items.map((m) => (
              <div key={m.id} className="flex items-start gap-2">
                <Avatar className="size-8">
                  <AvatarImage src={m.sender?.image || undefined} alt={m.sender?.name || m.senderId} />
                  <AvatarFallback>{initials(m.sender?.name || m.senderId)}</AvatarFallback>
                </Avatar>
                <div className="max-w-[75%]">
                  <div className="text-xs text-muted-foreground">
                    {m.sender?.name || m.senderId} • {formatTime(m.createdAt)}
                  </div>
                  {m.content ? (
                    <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-sm">
                      {m.content}
                    </div>
                  ) : null}
                  {m.fileUrl ? (
                    <FilePreview url={m.fileUrl} fileType={m.fileType || ""} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="border-t p-3">
        {typingText.length > 0 && (
          <div className="mb-1 text-xs text-muted-foreground">
            Someone is typing...
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border bg-background text-sm hover:bg-accent">
            <input type="file" className="hidden" onChange={onFileChange} disabled={uploading} />
            📎
          </label>
          <textarea
            className="min-h-[40px] w-full resize-none rounded-md border bg-background p-2 text-sm focus:outline-none"
            placeholder="Type a message..."
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
          />
          <button
            onClick={sendMessage}
            className="h-9 rounded-md bg-primary px-3 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            disabled={!input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function FilePreview({ url, fileType }: { url: string; fileType: string }) {
  if (fileType.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        <Image src={url} alt="uploaded" className="max-h-56 rounded-md border" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-xs">
      <span>📄</span>
      <span>File</span>
    </a>
  );
}
