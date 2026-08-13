-- AlterTable
ALTER TABLE "SpcCharacteristic" ADD COLUMN "customerId" TEXT;

-- AddForeignKey
ALTER TABLE "SpcCharacteristic" ADD CONSTRAINT "SpcCharacteristic_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
