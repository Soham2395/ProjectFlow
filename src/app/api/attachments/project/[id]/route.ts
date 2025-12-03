import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: projectId } = await params;
        const { searchParams } = new URL(req.url);

        const type = searchParams.get("type"); // image, document, etc.
        const userId = searchParams.get("userId");
        const limit = parseInt(searchParams.get("limit") || "20");
        const cursor = searchParams.get("cursor");

        // Verify permission
        const membership = await prisma.projectMember.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId,
                },
            },
        });

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true },
        });

        if (!membership && project?.ownerId !== session.user.id) {
            return NextResponse.json(
                { error: "Access denied" },
                { status: 403 }
            );
        }

        // Build filter query
        const where: any = { projectId };

        if (type) {
            if (type === "image") {
                where.fileType = { startsWith: "image/" };
            } else if (type === "video") {
                where.fileType = { startsWith: "video/" };
            } else if (type === "document") {
                where.fileType = {
                    in: [
                        "application/pdf",
                        "application/msword",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "application/vnd.ms-excel",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "text/plain",
                        "text/markdown"
                    ]
                };
            }
        }

        if (userId) {
            where.uploadedBy = userId;
        }

        // Fetch attachments
        const attachments = await prisma.attachment.findMany({
            where,
            take: limit + 1, // Fetch one extra to check for next page
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
                task: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        });

        let nextCursor: string | undefined = undefined;
        if (attachments.length > limit) {
            const nextItem = attachments.pop();
            nextCursor = nextItem?.id;
        }

        return NextResponse.json({
            attachments,
            pagination: {
                nextCursor,
                hasMore: !!nextCursor,
            },
        });
    } catch (error) {
        console.error("Error fetching project attachments:", error);
        return NextResponse.json(
            { error: "Failed to fetch attachments" },
            { status: 500 }
        );
    }
}
