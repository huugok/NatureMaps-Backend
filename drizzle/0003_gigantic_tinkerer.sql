CREATE TABLE "poi_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"poi_id" integer NOT NULL,
	"language" text NOT NULL,
	"description" text NOT NULL,
	"source" text DEFAULT 'WIKIPEDIA' NOT NULL,
	"source_url" text NOT NULL,
	"license" text,
	"license_url" text,
	CONSTRAINT "poi_profiles_text_check" CHECK (length(trim("poi_profiles"."description")) > 0 and length(trim("poi_profiles"."language")) > 0 and length(trim("poi_profiles"."source_url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "pois" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"image_url" text,
	"image_source_url" text,
	"image_author" text,
	"image_license" text,
	"image_license_url" text,
	"image_attribution" text,
	"address" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"source_url" text NOT NULL,
	"info_url" text,
	"wikidata_id" text,
	"wikipedia_url" text,
	"enriched_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pois_latitude_check" CHECK ("pois"."latitude" between -90 and 90),
	CONSTRAINT "pois_longitude_check" CHECK ("pois"."longitude" between -180 and 180),
	CONSTRAINT "pois_text_check" CHECK (length(trim("pois"."source")) > 0 and length(trim("pois"."external_id")) > 0 and length(trim("pois"."name")) > 0 and length(trim("pois"."category")) > 0 and length(trim("pois"."source_url")) > 0),
	CONSTRAINT "pois_image_check" CHECK ("pois"."image_url" is null or ("pois"."image_source_url" is not null and "pois"."image_author" is not null and "pois"."image_license" is not null and "pois"."image_license_url" is not null and "pois"."image_attribution" is not null))
);
--> statement-breakpoint
ALTER TABLE "poi_profiles" ADD CONSTRAINT "poi_profiles_poi_id_pois_id_fk" FOREIGN KEY ("poi_id") REFERENCES "public"."pois"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "poi_profiles_poi_language_unique" ON "poi_profiles" USING btree ("poi_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX "pois_source_external_unique" ON "pois" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "pois_coordinates_idx" ON "pois" USING btree ("latitude","longitude");