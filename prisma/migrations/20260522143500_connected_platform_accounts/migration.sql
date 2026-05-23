-- CreateTable
CREATE TABLE "ConnectedPlatformAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "channelTitle" TEXT,
    "publishedAt" TIMESTAMP(3),
    "subscriberCount" INTEGER,
    "uploadsPlaylistId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "scopes" TEXT,
    "tokenType" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedPlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedPlatformAccount_platform_providerAccountId_key" ON "ConnectedPlatformAccount"("platform", "providerAccountId");

-- CreateIndex
CREATE INDEX "ConnectedPlatformAccount_userId_platform_idx" ON "ConnectedPlatformAccount"("userId", "platform");

-- AddForeignKey
ALTER TABLE "ConnectedPlatformAccount" ADD CONSTRAINT "ConnectedPlatformAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
