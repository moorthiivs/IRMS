-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INSPECTOR');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PASSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'INSPECTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "partName" TEXT NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "operationNumber" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartOperation" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,

    CONSTRAINT "PartOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionParameter" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "parameterName" TEXT NOT NULL,
    "nominalValue" TEXT,
    "lowerTolerance" TEXT,
    "upperTolerance" TEXT,
    "specText" TEXT,
    "controlLimitMin" DOUBLE PRECISION,
    "controlLimitMax" DOUBLE PRECISION,
    "methodOfChecking" TEXT,
    "freqOfInspn" TEXT,
    "class" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InspectionParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTransaction" (
    "id" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "mcNo" TEXT,
    "intervalName" TEXT NOT NULL,
    "inspectionTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TransactionStatus" NOT NULL,
    "remarks" TEXT,

    CONSTRAINT "InspectionTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionDetail" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "observedValue" TEXT NOT NULL,
    "status" "ValidationStatus" NOT NULL,

    CONSTRAINT "InspectionDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadHistory" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "UploadStatus" NOT NULL,
    "totalRecords" INTEGER NOT NULL,
    "importedRecords" INTEGER NOT NULL,
    "errorLog" TEXT,

    CONSTRAINT "UploadHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_name_key" ON "Shift"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Part_partNumber_key" ON "Part"("partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_operationNumber_key" ON "Operation"("operationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PartOperation_partId_operationId_key" ON "PartOperation"("partId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionParameter_partId_operationId_parameterName_key" ON "InspectionParameter"("partId", "operationId", "parameterName");

-- AddForeignKey
ALTER TABLE "PartOperation" ADD CONSTRAINT "PartOperation_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartOperation" ADD CONSTRAINT "PartOperation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionParameter" ADD CONSTRAINT "InspectionParameter_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionParameter" ADD CONSTRAINT "InspectionParameter_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTransaction" ADD CONSTRAINT "InspectionTransaction_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTransaction" ADD CONSTRAINT "InspectionTransaction_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTransaction" ADD CONSTRAINT "InspectionTransaction_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTransaction" ADD CONSTRAINT "InspectionTransaction_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionDetail" ADD CONSTRAINT "InspectionDetail_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "InspectionTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionDetail" ADD CONSTRAINT "InspectionDetail_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "InspectionParameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadHistory" ADD CONSTRAINT "UploadHistory_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
