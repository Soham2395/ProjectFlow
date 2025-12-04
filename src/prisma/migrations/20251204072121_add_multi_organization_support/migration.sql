-- Step 1: Drop constraints and indexes that will be recreated
ALTER TABLE "public"."Invitation" DROP CONSTRAINT IF EXISTS "Invitation_projectId_fkey";
DROP INDEX IF EXISTS "public"."Invitation_email_projectId_status_key";
DROP INDEX IF EXISTS "public"."Project_name_idx";

-- Step 2: Create new tables for Organization, OrganizationMember, and Workspace
CREATE TABLE "public"."organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."organization_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- Step 3: Add organizationId columns as NULLABLE first (to handle existing data)
ALTER TABLE "public"."Activity" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "public"."Attachment" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "public"."ChatMessage" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "public"."Project" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "public"."Project" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "public"."Notification" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "public"."Invitation" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "public"."Invitation" ALTER COLUMN "projectId" DROP NOT NULL;

-- Step 4: Migrate existing data - create organizations for each project owner
-- For each unique project owner, create a "Personal Organization"
INSERT INTO "public"."organizations" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT 
    'org_' || "ownerId" as id,
    COALESCE(u.name, u.email, 'Personal') || '''s Organization' as name,
    'personal-' || "ownerId" as slug,
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "public"."Project" p
LEFT JOIN "public"."users" u ON p."ownerId" = u.id
WHERE p."ownerId" IS NOT NULL
GROUP BY p."ownerId", u.name, u.email
ON CONFLICT DO NOTHING;

-- Create organization memberships for project owners (as owners)
INSERT INTO "public"."organization_members" ("id", "userId", "organizationId", "role", "createdAt", "updatedAt")
SELECT 
    'orgmem_' || "ownerId" as id,
    "ownerId" as "userId",
    'org_' || "ownerId" as "organizationId",
    'owner' as role,
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "public"."Project"
WHERE "ownerId" IS NOT NULL
GROUP BY "ownerId"
ON CONFLICT DO NOTHING;

-- Also add existing project members to their project's organization
INSERT INTO "public"."organization_members" ("id", "userId", "organizationId", "role", "createdAt", "updatedAt")
SELECT 
    'orgmem_' || pm."userId" || '_'  || p."ownerId" as id,
    pm."userId",
    'org_' || p."ownerId" as "organizationId",
    CASE 
        WHEN pm.role = 'admin' THEN 'admin'
        ELSE 'member'
    END as role,
    NOW() as "createdAt",
    NOW() as "updatedAt"
FROM "public"."ProjectMember" pm
JOIN "public"."Project" p ON pm."projectId" = p.id
WHERE p."ownerId" IS NOT NULL AND pm."userId" != p."ownerId"
ON CONFLICT DO NOTHING;

-- Step 5: Populate organizationId for existing projects
UPDATE "public"."Project" 
SET "organizationId" = 'org_' || "ownerId"
WHERE "ownerId" IS NOT NULL;

-- Step 6: Populate organizationId for related tables
-- ChatMessage
UPDATE "public"."ChatMessage" cm
SET "organizationId" = p."organizationId"
FROM "public"."Project" p
WHERE cm."projectId" = p.id AND p."organizationId" IS NOT NULL;

-- Attachment
UPDATE "public"."Attachment" a
SET "organizationId" = p."organizationId"
FROM "public"."Project" p
WHERE a."projectId" = p.id AND p."organizationId" IS NOT NULL;

-- Activity
UPDATE "public"."Activity" a
SET "organizationId" = p."organizationId"
FROM "public"."Project" p
WHERE a."projectId" = p.id AND p."organizationId" IS NOT NULL;

-- Notification (only if projectId is set)
UPDATE "public"."Notification" n
SET "organizationId" = p."organizationId"
FROM "public"."Project" p
WHERE n."projectId" = p.id AND p."organizationId" IS NOT NULL;

-- Step 7: Make organizationId NOT NULL for required tables
ALTER TABLE "public"."Project" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "public"."ChatMessage" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "public"."Attachment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "public"."Activity" ALTER COLUMN "organizationId" SET NOT NULL;

-- Step 8: Create indexes
CREATE UNIQUE INDEX "organizations_slug_key" ON "public"."organizations"("slug");
CREATE INDEX "organizations_slug_idx" ON "public"."organizations"("slug");
CREATE INDEX "organization_members_userId_idx" ON "public"."organization_members"("userId");
CREATE INDEX "organization_members_organizationId_idx" ON "public"."organization_members"("organizationId");
CREATE INDEX "organization_members_organizationId_role_idx" ON "public"."organization_members"("organizationId", "role");
CREATE UNIQUE INDEX "organization_members_userId_organizationId_key" ON "public"."organization_members"("userId", "organizationId");
CREATE INDEX "workspaces_organizationId_idx" ON "public"."workspaces"("organizationId");
CREATE INDEX "Activity_organizationId_createdAt_idx" ON "public"."Activity"("organizationId", "createdAt");
CREATE INDEX "Attachment_organizationId_idx" ON "public"."Attachment"("organizationId");
CREATE INDEX "ChatMessage_organizationId_projectId_idx" ON "public"."ChatMessage"("organizationId", "projectId");
CREATE INDEX "Invitation_organizationId_idx" ON "public"."Invitation"("organizationId");
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "public"."Notification"("organizationId", "createdAt");
CREATE INDEX "Project_organizationId_idx" ON "public"."Project"("organizationId");
CREATE INDEX "Project_workspaceId_idx" ON "public"."Project"("workspaceId");
CREATE INDEX "Project_organizationId_name_idx" ON "public"."Project"("organizationId", "name");

-- Step 9: Add foreign keys
ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."workspaces" ADD CONSTRAINT "workspaces_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
