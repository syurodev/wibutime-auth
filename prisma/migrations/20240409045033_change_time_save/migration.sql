/*
  Warnings:

  - Changed the type of `created_at` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `updated_at` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "created_at",
ADD COLUMN     "created_at" INTEGER NOT NULL,
DROP COLUMN "updated_at",
ADD COLUMN     "updated_at" INTEGER NOT NULL;
