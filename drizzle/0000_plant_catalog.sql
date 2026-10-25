CREATE TABLE "plant_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"species_id" integer,
	"reported_scientific_name" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"district" text,
	"neighborhood" text,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plant_locations_latitude_check" CHECK ("plant_locations"."latitude" between -90 and 90),
	CONSTRAINT "plant_locations_longitude_check" CHECK ("plant_locations"."longitude" between -180 and 180),
	CONSTRAINT "plant_locations_source_check" CHECK (length(trim("plant_locations"."source")) > 0 and length(trim("plant_locations"."external_id")) > 0 and length(trim("plant_locations"."source_url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "plant_names" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_location_id" integer NOT NULL,
	"language" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "plant_names_nonempty_check" CHECK (length(trim("plant_names"."name")) > 0 and length(trim("plant_names"."language")) > 0)
);
--> statement-breakpoint
CREATE TABLE "species" (
	"id" serial PRIMARY KEY NOT NULL,
	"scientific_name" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "species_name_check" CHECK (length(trim("species"."scientific_name")) > 0 and length(trim("species"."source")) > 0)
);
--> statement-breakpoint
CREATE TABLE "species_enrichments" (
	"id" serial PRIMARY KEY NOT NULL,
	"species_id" integer NOT NULL,
	"source" text DEFAULT 'WIKIPEDIA' NOT NULL,
	"language" text NOT NULL,
	"source_url" text NOT NULL,
	"wikidata_id" text,
	"description" text,
	"extract" text,
	"license" text,
	"license_url" text,
	"image_url" text,
	"image_source_url" text,
	"image_author" text,
	"image_license" text,
	"image_license_url" text,
	"image_attribution" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "species_enrichments_text_check" CHECK (coalesce(length(trim("species_enrichments"."extract")), 0) > 0 or coalesce(length(trim("species_enrichments"."description")), 0) > 0),
	CONSTRAINT "species_enrichments_source_check" CHECK (length(trim("species_enrichments"."source")) > 0 and length(trim("species_enrichments"."language")) > 0 and length(trim("species_enrichments"."source_url")) > 0),
	CONSTRAINT "species_enrichments_image_check" CHECK ("species_enrichments"."image_url" is null or ("species_enrichments"."image_source_url" is not null and "species_enrichments"."image_author" is not null and "species_enrichments"."image_license" is not null and "species_enrichments"."image_license_url" is not null and "species_enrichments"."image_attribution" is not null))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "plant_locations" ADD CONSTRAINT "plant_locations_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_names" ADD CONSTRAINT "plant_names_plant_location_id_plant_locations_id_fk" FOREIGN KEY ("plant_location_id") REFERENCES "public"."plant_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species_enrichments" ADD CONSTRAINT "species_enrichments_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plant_locations_source_external_unique" ON "plant_locations" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "plant_locations_species_idx" ON "plant_locations" USING btree ("species_id");--> statement-breakpoint
CREATE INDEX "plant_locations_coordinates_idx" ON "plant_locations" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE UNIQUE INDEX "plant_names_location_language_unique" ON "plant_names" USING btree ("plant_location_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX "species_source_name_unique" ON "species" USING btree ("source","scientific_name");--> statement-breakpoint
CREATE UNIQUE INDEX "species_enrichments_species_source_language_unique" ON "species_enrichments" USING btree ("species_id","source","language");