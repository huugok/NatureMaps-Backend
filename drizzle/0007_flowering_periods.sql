CREATE TABLE "species_flowering_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"species_id" integer NOT NULL,
	"start_month" integer NOT NULL,
	"end_month" integer NOT NULL,
	"region" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	CONSTRAINT "species_flowering_periods_month_check" CHECK ("species_flowering_periods"."start_month" between 1 and 12 and "species_flowering_periods"."end_month" between 1 and 12),
	CONSTRAINT "species_flowering_periods_region_check" CHECK (length(trim("species_flowering_periods"."region")) > 0 and length(trim("species_flowering_periods"."source_name")) > 0 and length(trim("species_flowering_periods"."source_url")) > 0)
);
--> statement-breakpoint
ALTER TABLE "species_flowering_periods" ADD CONSTRAINT "species_flowering_periods_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "species_flowering_periods_species_idx" ON "species_flowering_periods" USING btree ("species_id");--> statement-breakpoint
CREATE INDEX "species_flowering_periods_months_idx" ON "species_flowering_periods" USING btree ("start_month","end_month");--> statement-breakpoint
CREATE UNIQUE INDEX "species_flowering_periods_unique" ON "species_flowering_periods" USING btree ("species_id","start_month","end_month","region","source_url");