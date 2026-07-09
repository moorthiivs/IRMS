-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'SUPERVISOR';
ALTER TYPE "Role" ADD VALUE 'OPERATOR';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "machines" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "InspectionTransaction" ADD COLUMN     "customerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "PokaYokeItem" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "pokaYokeName" TEXT NOT NULL,
    "checkingMethod" TEXT,
    "frequency" TEXT,
    "readingType" TEXT NOT NULL DEFAULT 'number',
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PokaYokeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokaYokeTransaction" (
    "id" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "shiftId" TEXT,
    "partId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "inspectionTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TransactionStatus" NOT NULL,
    "remarks" TEXT,
    "adminId" TEXT,
    "adminApprovalDate" TIMESTAMP(3),
    "mcNo" TEXT,
    "customerId" TEXT,

    CONSTRAINT "PokaYokeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokaYokeDetail" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "pokaYokeItemId" TEXT NOT NULL,
    "observedValue" TEXT NOT NULL,
    "status" "ValidationStatus" NOT NULL,
    "correctionAction" TEXT,

    CONSTRAINT "PokaYokeDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokaYokeDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftId" TEXT,
    "readingsData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokaYokeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PokaYokeItem_partId_operation_pokaYokeName_key" ON "PokaYokeItem"("partId", "operation", "pokaYokeName");

-- CreateIndex
CREATE UNIQUE INDEX "PokaYokeDraft_userId_partId_key" ON "PokaYokeDraft"("userId", "partId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTransaction" ADD CONSTRAINT "InspectionTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeItem" ADD CONSTRAINT "PokaYokeItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeTransaction" ADD CONSTRAINT "PokaYokeTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeTransaction" ADD CONSTRAINT "PokaYokeTransaction_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeTransaction" ADD CONSTRAINT "PokaYokeTransaction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeTransaction" ADD CONSTRAINT "PokaYokeTransaction_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeTransaction" ADD CONSTRAINT "PokaYokeTransaction_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeDetail" ADD CONSTRAINT "PokaYokeDetail_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PokaYokeTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeDetail" ADD CONSTRAINT "PokaYokeDetail_pokaYokeItemId_fkey" FOREIGN KEY ("pokaYokeItemId") REFERENCES "PokaYokeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeDraft" ADD CONSTRAINT "PokaYokeDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeDraft" ADD CONSTRAINT "PokaYokeDraft_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokaYokeDraft" ADD CONSTRAINT "PokaYokeDraft_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

