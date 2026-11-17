ALTER TYPE "public"."order_status" ADD VALUE 'paid' BEFORE 'transit';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_marked_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_url" text;