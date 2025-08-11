/*
  Warnings:

  - A unique constraint covering the columns `[user_id,purpose]` on the table `otp_tokens` will be added. If there are existing duplicate values, this will fail.
  - Made the column `user_id` on table `otp_tokens` required. This step will fail if there are existing NULL values in that column.
  - Made the column `expires_at` on table `otp_tokens` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."otp_tokens" DROP CONSTRAINT "otp_tokens_user_id_fkey";

-- AlterTable
ALTER TABLE "public"."otp_tokens" ALTER COLUMN "user_id" SET NOT NULL,
ALTER COLUMN "expires_at" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "otp_tokens_user_id_purpose_key" ON "public"."otp_tokens"("user_id", "purpose");

-- AddForeignKey
ALTER TABLE "public"."otp_tokens" ADD CONSTRAINT "otp_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
