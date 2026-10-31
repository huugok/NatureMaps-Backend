CREATE TABLE "species_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"species_id" integer NOT NULL,
	"language" text NOT NULL,
	"description" text,
	"family" text,
	"flowering" text,
	"curiosity" text,
	"sources" jsonb,
	CONSTRAINT "species_profiles_text_check" CHECK (coalesce(length(trim("species_profiles"."description")), 0) > 0 or coalesce(length(trim("species_profiles"."curiosity")), 0) > 0),
	CONSTRAINT "species_profiles_sources_check" CHECK ("species_profiles"."sources" is null or jsonb_typeof("species_profiles"."sources") = 'array'),
	CONSTRAINT "species_profiles_language_check" CHECK (length(trim("species_profiles"."language")) > 0)
);
--> statement-breakpoint
ALTER TABLE "species_profiles" ADD CONSTRAINT "species_profiles_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "species_profiles_species_language_unique" ON "species_profiles" USING btree ("species_id","language");