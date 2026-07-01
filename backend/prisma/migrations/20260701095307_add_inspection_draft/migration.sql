-- CreateTable
CREATE TABLE "InspectionDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "shiftId" TEXT,
    "intervalName" TEXT,
    "mcNo" TEXT,
    "lotNumber" TEXT,
    "remarks" TEXT,
    "readingsData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InspectionDraft_userId_partId_operationId_key" ON "InspectionDraft"("userId", "partId", "operationId");

-- AddForeignKey
ALTER TABLE "InspectionDraft" ADD CONSTRAINT "InspectionDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionDraft" ADD CONSTRAINT "InspectionDraft_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionDraft" ADD CONSTRAINT "InspectionDraft_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
