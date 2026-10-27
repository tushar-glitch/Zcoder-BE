-- CreateEnum
CREATE TYPE "InquiryType" AS ENUM ('CONTACT', 'PROJECT');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'REPLIED');

-- CreateEnum
CREATE TYPE "InquirySource" AS ENUM ('WEB', 'MOBILE');

-- CreateEnum
CREATE TYPE "ReplyDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL,
    "type" "InquiryType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "service_interest" TEXT,
    "budget_range" TEXT,
    "timeline" TEXT,
    "source" "InquirySource" NOT NULL DEFAULT 'WEB',
    "source_page" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_replies" (
    "id" UUID NOT NULL,
    "inquiry_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "delivery_status" "ReplyDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "sent_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_status_created_at_idx" ON "inquiries"("status", "created_at");

-- CreateIndex
CREATE INDEX "inquiries_email_created_at_idx" ON "inquiries"("email", "created_at");

-- CreateIndex
CREATE INDEX "inquiry_replies_inquiry_id_idx" ON "inquiry_replies"("inquiry_id");

-- CreateIndex
CREATE INDEX "inquiry_replies_delivery_status_idx" ON "inquiry_replies"("delivery_status");

-- AddForeignKey
ALTER TABLE "inquiry_replies" ADD CONSTRAINT "inquiry_replies_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_replies" ADD CONSTRAINT "inquiry_replies_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
