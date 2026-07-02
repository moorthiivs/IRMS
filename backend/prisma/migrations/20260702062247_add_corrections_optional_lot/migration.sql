-- AlterTable
ALTER TABLE "InspectionTransaction" ALTER COLUMN "lotNumber" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CorrectionEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "detailId" TEXT NOT NULL,
    "previousValue" TEXT NOT NULL,
    "correctedValue" TEXT NOT NULL,
    "previousStatus" "ValidationStatus" NOT NULL,
    "correctedStatus" "ValidationStatus" NOT NULL,
    "correctedById" TEXT NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "CorrectionEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CorrectionEntry" ADD CONSTRAINT "CorrectionEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InspectionTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionEntry" ADD CONSTRAINT "CorrectionEntry_detailId_fkey" FOREIGN KEY ("detailId") REFERENCES "InspectionDetail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionEntry" ADD CONSTRAINT "CorrectionEntry_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
