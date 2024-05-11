-- CreateTable
CREATE TABLE "verification_email_token" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "reset_password_token" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" BIGINT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_token_id_key" ON "verification_email_token"("id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_token_email_key" ON "verification_email_token"("email");

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_token_token_key" ON "verification_email_token"("token");

-- CreateIndex
CREATE UNIQUE INDEX "reset_password_token_id_key" ON "reset_password_token"("id");

-- CreateIndex
CREATE UNIQUE INDEX "reset_password_token_email_key" ON "reset_password_token"("email");

-- CreateIndex
CREATE UNIQUE INDEX "reset_password_token_token_key" ON "reset_password_token"("token");
