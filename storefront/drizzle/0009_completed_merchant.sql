ALTER TABLE "tasks" ADD COLUMN "completed_website" text;--> statement-breakpoint
UPDATE tasks t SET completed_website=rtrim(s.website,'/') FROM stores s WHERE s.id=t.store_id AND t.completed IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX completed_merchant_employee ON tasks(employee_id,completed_website) WHERE completed_website IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION remember_completed_website() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.completed IS NULL AND NEW.completed IS NOT NULL THEN
  SELECT rtrim(website,'/') INTO NEW.completed_website FROM stores WHERE id=NEW.store_id;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER remember_merchant BEFORE UPDATE OF completed ON tasks FOR EACH ROW EXECUTE FUNCTION remember_completed_website();
