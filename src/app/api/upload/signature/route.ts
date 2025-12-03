import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { folder } = await req.json();

        // Generate timestamp
        const timestamp = Math.round(new Date().getTime() / 1000);

        // For signed uploads, we sign the parameters
        // Don't include upload_preset for signed uploads
        const paramsToSign = {
            timestamp: timestamp,
            folder: folder,
        };

        const signature = cloudinary.utils.api_sign_request(
            paramsToSign,
            process.env.CLOUDINARY_API_SECRET!
        );

        return NextResponse.json({
            signature,
            timestamp,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            folder,
        });
    } catch (error) {
        console.error("Error generating signature:", error);
        return NextResponse.json(
            { error: "Failed to generate signature" },
            { status: 500 }
        );
    }
}
