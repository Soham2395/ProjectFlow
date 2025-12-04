import { prisma } from "@/lib/prisma";

/**
 * Organization role hierarchy (highest to lowest):
 * owner > admin > member > viewer
 */
const ROLE_HIERARCHY = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
} as const;

type OrgRole = keyof typeof ROLE_HIERARCHY;

/**
 * Get a user's role in an organization
 */
export async function getOrganizationRole(
    userId: string,
    organizationId: string
): Promise<OrgRole | null> {
    const membership = await prisma.organizationMember.findUnique({
        where: {
            userId_organizationId: {
                userId,
                organizationId,
            },
        },
        select: { role: true },
    });

    return membership?.role as OrgRole | null;
}

/**
 * Check if a user has a minimum required role in an organization
 */
export async function hasMinimumOrgRole(
    userId: string,
    organizationId: string,
    minimumRole: OrgRole
): Promise<boolean> {
    const userRole = await getOrganizationRole(userId, organizationId);
    if (!userRole) return false;

    const userLevel = ROLE_HIERARCHY[userRole];
    const requiredLevel = ROLE_HIERARCHY[minimumRole];

    return userLevel >= requiredLevel;
}

/**
 * Assert that a user has access to an organization with an optional minimum role
 * Throws an error if the user lacks access
 */
export async function assertOrgAccess(
    userId: string,
    organizationId: string,
    minimumRole?: OrgRole
): Promise<void> {
    const userRole = await getOrganizationRole(userId, organizationId);

    if (!userRole) {
        throw new Error("User is not a member of this organization");
    }

    if (minimumRole) {
        const userLevel = ROLE_HIERARCHY[userRole];
        const requiredLevel = ROLE_HIERARCHY[minimumRole];

        if (userLevel < requiredLevel) {
            throw new Error(
                `Insufficient permissions. Required: ${minimumRole}, Current: ${userRole}`
            );
        }
    }
}

/**
 * Check if a user can access a workspace
 */
export async function canAccessWorkspace(
    userId: string,
    workspaceId: string
): Promise<boolean> {
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { organizationId: true },
    });

    if (!workspace) return false;

    const userRole = await getOrganizationRole(userId, workspace.organizationId);
    return !!userRole;
}

/**
 * Check if a user can access a project (through organization membership)
 */
export async function canAccessProject(
    userId: string,
    projectId: string
): Promise<boolean> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
    });

    if (!project) return false;

    const userRole = await getOrganizationRole(userId, project.organizationId);
    return !!userRole;
}

/**
 * Get all organizations a user belongs to
 */
export async function getUserOrganizations(userId: string) {
    const memberships = await prisma.organizationMember.findMany({
        where: { userId },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    createdAt: true,
                    settings: true,
                },
            },
        },
        orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
        ...m.organization,
        role: m.role as OrgRole,
    }));
}

/**
 * Check if a user is an organization owner
 */
export async function isOrgOwner(
    userId: string,
    organizationId: string
): Promise<boolean> {
    return hasMinimumOrgRole(userId, organizationId, "owner");
}

/**
 * Check if a user is an organization admin or owner
 */
export async function isOrgAdmin(
    userId: string,
    organizationId: string
): Promise<boolean> {
    return hasMinimumOrgRole(userId, organizationId, "admin");
}

/**
 * Get the organization ID for a project
 */
export async function getProjectOrganizationId(
    projectId: string
): Promise<string | null> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
    });

    return project?.organizationId || null;
}

/**
 * Verify that a project belongs to a specific organization
 */
export async function verifyProjectInOrganization(
    projectId: string,
    organizationId: string
): Promise<boolean> {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            organizationId,
        },
        select: { id: true },
    });

    return !!project;
}

/**
 * Get organization members with their user details
 */
export async function getOrganizationMembers(organizationId: string) {
    const members = await prisma.organizationMember.findMany({
        where: { organizationId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                },
            },
        },
        orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    });

    return members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role as OrgRole,
        createdAt: m.createdAt,
    }));
}

/**
 * Create a new organization and make the creator an owner
 */
export async function createOrganization(
    userId: string,
    name: string,
    slug?: string,
    settings?: any
) {
    const organization = await prisma.organization.create({
        data: {
            name,
            slug,
            settings,
            members: {
                create: {
                    userId,
                    role: "owner",
                },
            },
        },
        include: {
            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                        },
                    },
                },
            },
        },
    });

    return organization;
}

/**
 * Add a user to an organization with a specific role
 */
export async function addOrganizationMember(
    organizationId: string,
    userId: string,
    role: OrgRole
) {
    return prisma.organizationMember.create({
        data: {
            organizationId,
            userId,
            role,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                },
            },
        },
    });
}

/**
 * Update a member's role in an organization
 * Only organization owners can do this
 */
export async function updateMemberRole(
    actorId: string,
    organizationId: string,
    targetUserId: string,
    newRole: OrgRole
) {
    // Verify actor is owner
    await assertOrgAccess(actorId, organizationId, "owner");

    // Prevent owner from changing their own role if they're the only owner
    if (actorId === targetUserId && newRole !== "owner") {
        const ownerCount = await prisma.organizationMember.count({
            where: {
                organizationId,
                role: "owner",
            },
        });

        if (ownerCount === 1) {
            throw new Error("Cannot change your role as the only owner");
        }
    }

    return prisma.organizationMember.update({
        where: {
            userId_organizationId: {
                userId: targetUserId,
                organizationId,
            },
        },
        data: { role: newRole },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                },
            },
        },
    });
}

/**
 * Remove a member from an organization
 * Owners can remove anyone, members can remove themselves
 */
export async function removeMember(
    actorId: string,
    organizationId: string,
    targetUserId: string
) {
    const isSelf = actorId === targetUserId;

    if (!isSelf) {
        // Only owners can remove other members
        await assertOrgAccess(actorId, organizationId, "owner");
    }

    // Prevent owner from removing themselves if they're the only owner
    if (isSelf) {
        const actorRole = await getOrganizationRole(actorId, organizationId);
        if (actorRole === "owner") {
            const ownerCount = await prisma.organizationMember.count({
                where: {
                    organizationId,
                    role: "owner",
                },
            });

            if (ownerCount === 1) {
                throw new Error("Cannot leave as the only owner");
            }
        }
    }

    return prisma.organizationMember.delete({
        where: {
            userId_organizationId: {
                userId: targetUserId,
                organizationId,
            },
        },
    });
}
