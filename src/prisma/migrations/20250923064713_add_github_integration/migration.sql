-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "githubIntegrationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "repoName" TEXT,
ADD COLUMN     "repoOwner" TEXT,
ADD COLUMN     "repoUrl" TEXT;

-- CreateTable
CREATE TABLE "public"."GitHubToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "tokenType" TEXT,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitHubToken_userId_key" ON "public"."GitHubToken"("userId");

-- AddForeignKey
ALTER TABLE "public"."GitHubToken" ADD CONSTRAINT "GitHubToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
