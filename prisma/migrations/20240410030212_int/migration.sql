/*
  Warnings:

  - You are about to alter the column `coins` on the `users` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "coins" SET DATA TYPE INTEGER;
