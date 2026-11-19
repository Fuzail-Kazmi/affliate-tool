CREATE TABLE "offer_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"admin_id" integer NOT NULL,
	"url" text NOT NULL,
	"result" jsonb NOT NULL,
	"saved" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "offer_scans" ADD CONSTRAINT "offer_scans_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_scans" ADD CONSTRAINT "offer_scans_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;