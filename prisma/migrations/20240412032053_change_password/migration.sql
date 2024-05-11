/*
  Warnings:

  - You are about to drop the `reset_password_code` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "reset_password_code";

-- CreateTable
CREATE TABLE "forgot_password_code" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "expires" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "change_password_code" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "expires" BIGINT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "forgot_password_code_id_key" ON "forgot_password_code"("id");

-- CreateIndex
CREATE UNIQUE INDEX "forgot_password_code_email_key" ON "forgot_password_code"("email");

-- CreateIndex
CREATE UNIQUE INDEX "forgot_password_code_code_key" ON "forgot_password_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "change_password_code_id_key" ON "change_password_code"("id");

-- CreateIndex
CREATE UNIQUE INDEX "change_password_code_email_key" ON "change_password_code"("email");

-- CreateIndex
CREATE UNIQUE INDEX "change_password_code_code_key" ON "change_password_code"("code");
