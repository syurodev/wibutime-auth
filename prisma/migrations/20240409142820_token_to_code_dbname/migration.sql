/*
  Warnings:

  - You are about to drop the `reset_password_token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `verification_email_token` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "reset_password_token";

-- DropTable
DROP TABLE "verification_email_token";

-- CreateTable
CREATE TABLE "verification_email_code" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "expires" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "reset_password_code" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "expires" BIGINT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_code_id_key" ON "verification_email_code"("id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_code_email_key" ON "verification_email_code"("email");

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_code_code_key" ON "verification_email_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reset_password_code_id_key" ON "reset_password_code"("id");

-- CreateIndex
CREATE UNIQUE INDEX "reset_password_code_email_key" ON "reset_password_code"("email");

-- CreateIndex
CREATE UNIQUE INDEX "reset_password_code_code_key" ON "reset_password_code"("code");
