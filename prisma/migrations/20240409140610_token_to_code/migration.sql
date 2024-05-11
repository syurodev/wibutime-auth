/*
  Warnings:

  - You are about to drop the column `token` on the `reset_password_token` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `verification_email_token` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `reset_password_token` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `verification_email_token` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `reset_password_token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `verification_email_token` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "reset_password_token_token_key";

-- DropIndex
DROP INDEX "verification_email_token_token_key";

-- AlterTable
ALTER TABLE "reset_password_token" DROP COLUMN "token",
ADD COLUMN     "code" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "verification_email_token" DROP COLUMN "token",
ADD COLUMN     "code" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "reset_password_token_code_key" ON "reset_password_token"("code");

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_token_code_key" ON "verification_email_token"("code");
