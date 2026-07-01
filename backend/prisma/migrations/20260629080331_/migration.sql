-- DropForeignKey
ALTER TABLE "InspectionTransaction" DROP CONSTRAINT "InspectionTransaction_shiftId_fkey";

-- AlterTable
ALTER TABLE "InspectionTransaction" ALTER COLUMN "shiftId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "InspectionTransaction" ADD CONSTRAINT "InspectionTransaction_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
