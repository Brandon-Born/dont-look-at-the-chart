-- AlterTable
ALTER TABLE "User" ADD COLUMN     "quietTimeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quietTimeZone" TEXT;
