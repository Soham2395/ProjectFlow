"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/components/organization";
import { Building2, ArrowLeft, Trash2, UserMinus, Crown, Shield, User, Eye } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Member {
    id: string;
    userId: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
    createdAt: string;
}

interface OrgDetails {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
    createdAt: string;
    _count: {
        members: number;
        workspaces: number;
        projects: number;
    };
}

const roleIcons: Record<string, typeof Crown> = {
    owner: Crown,
    admin: Shield,
    member: User,
    viewer: Eye,
};

const roleLabels: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    viewer: "Viewer",
};

export default function OrganizationSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { currentOrg, refetch } = useOrganization();
    const [org, setOrg] = useState<OrgDetails | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [myRole, setMyRole] = useState<string>("");

    // Edit state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [saving, setSaving] = useState(false);

    // Invite state
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("member");
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const [orgRes, membersRes] = await Promise.all([
                    fetch(`/api/organizations/${id}`),
                    fetch(`/api/organizations/${id}/members`),
                ]);

                if (!orgRes.ok) {
                    throw new Error("Organization not found");
                }

                const orgData = await orgRes.json();
                const membersData = await membersRes.json();

                setOrg(orgData.organization);
                setName(orgData.organization.name);
                setSlug(orgData.organization.slug);
                setMyRole(orgData.organization.userRole);
                setMembers(membersData.members || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [id]);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const res = await fetch(`/api/organizations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, slug }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update");
            }

            await refetch();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;

        setInviting(true);
        try {
            const res = await fetch(`/api/organizations/${id}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to invite");
            }

            setInviteEmail("");
            // Refresh members
            const membersRes = await fetch(`/api/organizations/${id}/members`);
            const membersData = await membersRes.json();
            setMembers(membersData.members || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm("Are you sure you want to remove this member?")) return;

        try {
            const res = await fetch(`/api/organizations/${id}/members?userId=${userId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to remove member");
            }

            setMembers((prev) => prev.filter((m) => m.userId !== userId));
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this organization? This cannot be undone.")) return;

        try {
            const res = await fetch(`/api/organizations/${id}`, { method: "DELETE" });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to delete");
            }

            await refetch();
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <main className="container mx-auto max-w-2xl px-4 py-10">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded bg-muted" />
                    <div className="h-64 rounded-lg bg-muted" />
                </div>
            </main>
        );
    }

    if (!org) {
        return (
            <main className="container mx-auto max-w-2xl px-4 py-10">
                <div className="text-center">
                    <h1 className="text-xl font-semibold">Organization not found</h1>
                    <Link href="/dashboard" className="mt-4 inline-block text-primary hover:underline">
                        Back to Dashboard
                    </Link>
                </div>
            </main>
        );
    }

    const canEdit = myRole === "owner" || myRole === "admin";
    const isOwner = myRole === "owner";

    return (
        <main className="container mx-auto max-w-2xl px-4 py-10">
            <Link
                href="/dashboard"
                className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
            </Link>

            {error && (
                <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}

            {/* Organization Details */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Organization Settings</h1>
                        <p className="text-sm text-muted-foreground">
                            {org._count.projects} projects · {org._count.members} members
                        </p>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Name</label>
                        <input
                            className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!canEdit}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Slug</label>
                        <input
                            className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            disabled={!canEdit}
                        />
                    </div>

                    {canEdit && (
                        <div className="flex justify-end">
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Members */}
            <div className="mt-6 rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Members ({members.length})</h2>

                {canEdit && (
                    <form onSubmit={handleInvite} className="mt-4 flex gap-2">
                        <input
                            className="flex-1 rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="Email address"
                            type="email"
                        />
                        <select
                            className="rounded-md border bg-transparent px-3 py-2"
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                        >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                        </select>
                        <Button type="submit" disabled={inviting}>
                            {inviting ? "..." : "Invite"}
                        </Button>
                    </form>
                )}

                <div className="mt-4 divide-y">
                    {members.map((member) => {
                        const RoleIcon = roleIcons[member.role] || User;
                        return (
                            <div key={member.userId} className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={member.image || undefined} />
                                        <AvatarFallback>{member.name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-medium">{member.name || member.email}</div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <RoleIcon className="h-3 w-3" />
                                            {roleLabels[member.role] || member.role}
                                        </div>
                                    </div>
                                </div>
                                {isOwner && member.role !== "owner" && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => handleRemoveMember(member.userId)}
                                    >
                                        <UserMinus className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Danger Zone */}
            {isOwner && (
                <div className="mt-6 rounded-lg border border-destructive/50 bg-destructive/5 p-6">
                    <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Deleting this organization will remove all projects and data permanently.
                    </p>
                    <Button variant="destructive" className="mt-4" onClick={handleDelete}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Organization
                    </Button>
                </div>
            )}
        </main>
    );
}
