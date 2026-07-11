-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "activeMachines" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT;
