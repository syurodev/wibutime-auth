-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "image" TEXT,
    "image_key" TEXT,
    "summary" JSONB,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL DEFAULT 'credential',
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_email_code" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "expires" BIGINT NOT NULL
);

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

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_PermissionToRole" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_name_username_idx" ON "users"("name", "username");

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_code_id_key" ON "verification_email_code"("id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_code_email_key" ON "verification_email_code"("email");

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_code_code_key" ON "verification_email_code"("code");

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

-- CreateIndex
CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole"("A", "B");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
