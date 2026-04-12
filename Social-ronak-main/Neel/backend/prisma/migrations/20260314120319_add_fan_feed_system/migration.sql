/*
  Warnings:

  - You are about to drop the `SocialAccount` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "MetaConnection" ADD COLUMN "accessTokenSecret" TEXT;
ALTER TABLE "MetaConnection" ADD COLUMN "apiKey" TEXT;
ALTER TABLE "MetaConnection" ADD COLUMN "apiSecret" TEXT;
ALTER TABLE "MetaConnection" ADD COLUMN "authorUrn" TEXT;
ALTER TABLE "MetaConnection" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "MetaConnection" ADD COLUMN "lastFetchAt" DATETIME;
ALTER TABLE "MetaConnection" ADD COLUMN "refreshToken" TEXT;
ALTER TABLE "MetaConnection" ADD COLUMN "scopes" TEXT DEFAULT '';
ALTER TABLE "MetaConnection" ADD COLUMN "tokenType" TEXT DEFAULT 'bearer';

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SocialAccount";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "themeJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Theme_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostSyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "newPosts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostSyncLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL DEFAULT 'Guest',
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PostShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Fan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "profileImage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FeedPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Like" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fanId" TEXT NOT NULL,
    "feedPostId" TEXT,
    "reelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Like_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Like_feedPostId_fkey" FOREIGN KEY ("feedPostId") REFERENCES "FeedPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Like_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fanId" TEXT NOT NULL,
    "feedPostId" TEXT,
    "reelId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "Fan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comment_feedPostId_fkey" FOREIGN KEY ("feedPostId") REFERENCES "FeedPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comment_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalPostId" TEXT,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "publishedAt" DATETIME,
    "engagementCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'platform',
    "importedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    CONSTRAINT "Post_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("companyId", "content", "createdAt", "engagementCount", "externalPostId", "id", "mediaUrl", "platform", "publishedAt", "updatedAt") SELECT "companyId", "content", "createdAt", "engagementCount", "externalPostId", "id", "mediaUrl", "platform", "publishedAt", "updatedAt" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE UNIQUE INDEX "Post_companyId_externalPostId_key" ON "Post"("companyId", "externalPostId");
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "logoUrl" TEXT,
    "bio" TEXT,
    "themeJson" TEXT,
    "openaiApiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Company" ("bio", "createdAt", "id", "logoUrl", "name", "plan", "slug", "updatedAt") SELECT "bio", "createdAt", "id", "logoUrl", "name", "plan", "slug", "updatedAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE TABLE "new_ScheduledPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "lastAttemptAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "jobId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "apiResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduledPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduledPost" ("apiResponse", "companyId", "content", "createdAt", "id", "jobId", "mediaUrl", "platform", "scheduledAt", "status", "updatedAt", "userId") SELECT "apiResponse", "companyId", "content", "createdAt", "id", "jobId", "mediaUrl", "platform", "scheduledAt", "status", "updatedAt", "userId" FROM "ScheduledPost";
DROP TABLE "ScheduledPost";
ALTER TABLE "new_ScheduledPost" RENAME TO "ScheduledPost";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Fan_email_key" ON "Fan"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Like_fanId_feedPostId_key" ON "Like"("fanId", "feedPostId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_fanId_reelId_key" ON "Like"("fanId", "reelId");
