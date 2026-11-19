CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"role" text NOT NULL,
	"action" text NOT NULL,
	"previous" jsonb,
	"updated" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer,
	"store_name" text NOT NULL,
	"employee_id" integer,
	"kind" text NOT NULL,
	"sheet" text,
	"started" timestamp with time zone,
	"completed" timestamp with time zone,
	"created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'Admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "grants" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX open_store_task ON tasks(store_id) WHERE completed IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX completed_pair ON tasks(store_id,employee_id) WHERE completed IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX employee_clock ON tasks(employee_id) WHERE started IS NOT NULL AND completed IS NULL;
--> statement-breakpoint
CREATE FUNCTION unity_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO activity_log(actor,role,action,previous,updated)
 VALUES(COALESCE(NULLIF(current_setting('unity.actor',true),''),'System'),COALESCE(NULLIF(current_setting('unity.role',true),''),'System'),
 TG_TABLE_NAME || ' ' || lower(TG_OP),to_jsonb(OLD)-'password_hash'-'result',to_jsonb(NEW)-'password_hash'-'result');
 RETURN NULL;
END $$;
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['stores','users','coupons','tasks','offer_scans','products'] LOOP
 EXECUTE format('CREATE TRIGGER record_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION unity_audit()', t);
END LOOP; END $$;
