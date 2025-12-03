import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            projectId,
            taskId,
            commentId,
            url,
            fileName,
            fileType,
            fileSize,
            publicId
        } = body;

        if (!projectId || !url || !fileName || !fileType) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Verify user is a member of the project
        const membership = await prisma.projectMember.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId,
                },
            },
        });

        // Also allow project owner
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true },
        });

        if (!membership && project?.ownerId !== session.user.id) {
            return NextResponse.json(
                { error: "You do not have permission to upload files to this project" },
                { status: 403 }
            );
        }

        // Create attachment record
        const attachment = await prisma.attachment.create({
            data: {
                projectId,
                taskId,
                commentId,
                url,
                fileName,
                fileType,
                fileSize: fileSize || 0,
                publicId,
                uploadedBy: session.user.id,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });

        return NextResponse.json(attachment);
    } catch (error) {
        console.error("Error creating attachment:", error);
        return NextResponse.json(
            { error: "Failed to create attachment record" },
            { status: 500 }
        );
    }
}
