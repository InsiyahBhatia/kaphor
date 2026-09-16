-- CreateTable
CREATE TABLE "glie_corrections" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT,
    "userId" TEXT,
    "garmentCategory" TEXT NOT NULL,
    "fiberType" TEXT NOT NULL,
    "originalConditionScore" DOUBLE PRECISION NOT NULL,
    "correctedConditionScore" DOUBLE PRECISION NOT NULL,
    "originalRouting" TEXT NOT NULL,
    "correctedRouting" TEXT NOT NULL,
    "originalPriceInr" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "glie_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "glie_corrections_userId_idx" ON "glie_corrections"("userId");

-- CreateIndex
CREATE INDEX "glie_corrections_garmentCategory_fiberType_idx" ON "glie_corrections"("garmentCategory", "fiberType");

-- AddForeignKey
ALTER TABLE "glie_corrections" ADD CONSTRAINT "glie_corrections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
