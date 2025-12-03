import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import cloudinary from "@/lib/cloudinary";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Get attachment to check permissions
        const attachment = await prisma.attachment.findUnique({
            where: { id },
            select: {
                id: true,
                uploadedBy: true,
                publicId: true,
                project: {
                    select: { ownerId: true },
                },
            },
        });

        if (!attachment) {
            return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
        }

        // Check if user is uploader or project owner
        const isUploader = attachment.uploadedBy === session.user.id;
        const isProjectOwner = attachment.project.ownerId === session.user.id;

        if (!isUploader && !isProjectOwner) {
            return NextResponse.json(
                { error: "You do not have permission to delete this file" },
                { status: 403 }
            );
        }

        // Delete from Cloudinary if publicId exists
        if (attachment.publicId) {
            try {
                await cloudinary.uploader.destroy(attachment.publicId);
            } catch (cloudinaryError) {
                console.error("Failed to delete from Cloudinary:", cloudinaryError);
                // Continue to delete from DB even if Cloudinary fails
            }
        }

        // Delete from database
        await prisma.attachment.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting attachment:", error);
        return NextResponse.json(
            { error: "Failed to delete attachment" },
            { status: 500 }
        );
    }
}
