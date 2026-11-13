CREATE TABLE "editorial_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"language" text NOT NULL,
	"topic" text NOT NULL,
	"green_area_group" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"sources" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "editorial_articles_text_check" CHECK (length(trim("editorial_articles"."slug")) > 0 and length(trim("editorial_articles"."language")) > 0 and length(trim("editorial_articles"."title")) > 0 and length(trim("editorial_articles"."summary")) > 0 and length(trim("editorial_articles"."body")) > 0),
	CONSTRAINT "editorial_articles_topic_check" CHECK ("editorial_articles"."topic" in ('flora', 'parques', 'jardines', 'paisajismo')),
	CONSTRAINT "editorial_articles_sources_check" CHECK (jsonb_typeof("editorial_articles"."sources") = 'array' and jsonb_array_length("editorial_articles"."sources") > 0)
);
--> statement-breakpoint
CREATE TABLE "green_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"reported_name" text NOT NULL,
	"group_slug" text NOT NULL,
	"typology" text,
	"neighborhood" text,
	"area_m2" double precision,
	"featured" boolean DEFAULT false NOT NULL,
	"geometry" jsonb NOT NULL,
	"min_latitude" double precision NOT NULL,
	"max_latitude" double precision NOT NULL,
	"min_longitude" double precision NOT NULL,
	"max_longitude" double precision NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"source_url" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "green_areas_text_check" CHECK (length(trim("green_areas"."source")) > 0 and length(trim("green_areas"."external_id")) > 0 and length(trim("green_areas"."name")) > 0 and length(trim("green_areas"."group_slug")) > 0 and length(trim("green_areas"."source_url")) > 0),
	CONSTRAINT "green_areas_geometry_check" CHECK (jsonb_typeof("green_areas"."geometry") = 'object'),
	CONSTRAINT "green_areas_bbox_check" CHECK ("green_areas"."min_latitude" <= "green_areas"."max_latitude" and "green_areas"."min_longitude" <= "green_areas"."max_longitude" and "green_areas"."latitude" between -90 and 90 and "green_areas"."longitude" between -180 and 180)
);
--> statement-breakpoint
ALTER TABLE "plant_locations" ADD COLUMN "green_area_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_articles_slug_language_unique" ON "editorial_articles" USING btree ("slug","language");--> statement-breakpoint
CREATE INDEX "editorial_articles_topic_idx" ON "editorial_articles" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "editorial_articles_group_idx" ON "editorial_articles" USING btree ("green_area_group");--> statement-breakpoint
CREATE UNIQUE INDEX "green_areas_source_external_unique" ON "green_areas" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "green_areas_group_idx" ON "green_areas" USING btree ("group_slug");--> statement-breakpoint
CREATE INDEX "green_areas_bbox_idx" ON "green_areas" USING btree ("min_latitude","max_latitude","min_longitude","max_longitude");--> statement-breakpoint
ALTER TABLE "plant_locations" ADD CONSTRAINT "plant_locations_green_area_id_green_areas_id_fk" FOREIGN KEY ("green_area_id") REFERENCES "public"."green_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plant_locations_green_area_idx" ON "plant_locations" USING btree ("green_area_id");