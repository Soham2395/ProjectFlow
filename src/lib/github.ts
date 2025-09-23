import { Octokit } from "octokit";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

export async function getDecryptedGitHubToken(userId: string): Promise<string | null> {
  const rec = await prisma.gitHubToken.findUnique({ where: { userId } });
  if (!rec) return null;
  try {
    const token = decrypt(rec.encryptedAccessToken, rec.iv, rec.authTag);
    return token;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[github] Failed to decrypt token for user", userId, e);
    }
    return null;
  }
}

export async function getOctokitForUser(userId: string): Promise<Octokit | null> {
  const token = await getDecryptedGitHubToken(userId);
  if (!token) return null;
  return new Octokit({ auth: token });
}

// Returns an Octokit client to access a project's repository using the best available token.
// Preference order:
// 1) Requesting user's token
// 2) Project owner's token
// 3) Any admin member's token
export async function getOctokitForProject(projectId: string, requesterUserId: string): Promise<Octokit | null> {
  // First try requester
  const own = await getOctokitForUser(requesterUserId);
  if (own) return own;

  // Load project with owner and members (roles)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { userId: true, role: true } } },
  });
  if (!project) return null;

  // Then try owner
  if (project.ownerId) {
    const ownerOcto = await getOctokitForUser(project.ownerId);
    if (ownerOcto) return ownerOcto;
  }

  // Finally try any admin member
  const admin = project.members.find((m: { userId: string; role: string }) => m.role === "admin");
  if (admin) {
    const adminOcto = await getOctokitForUser(admin.userId);
    if (adminOcto) return adminOcto;
  }

  return null;
}
