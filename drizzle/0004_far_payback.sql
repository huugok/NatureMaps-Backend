CREATE TABLE "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"theme" text NOT NULL,
	"shape" text NOT NULL,
	"length_category" text NOT NULL,
	"distance_meters" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"start_latitude" double precision NOT NULL,
	"start_longitude" double precision NOT NULL,
	"description" text NOT NULL,
	"stops" jsonb NOT NULL,
	"path" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routes_theme_check" CHECK ("routes"."theme" in ('botanica', 'cultural', 'mixta')),
	CONSTRAINT "routes_shape_check" CHECK ("routes"."shape" in ('circular', 'lineal')),
	CONSTRAINT "routes_length_category_check" CHECK ("routes"."length_category" in ('corta', 'media', 'larga')),
	CONSTRAINT "routes_text_check" CHECK (length(trim("routes"."name")) > 0 and length(trim("routes"."description")) > 0),
	CONSTRAINT "routes_values_check" CHECK ("routes"."distance_meters" > 0 and "routes"."duration_seconds" > 0),
	CONSTRAINT "routes_json_check" CHECK (jsonb_typeof("routes"."stops") = 'array' and jsonb_typeof("routes"."path") = 'array' and jsonb_array_length("routes"."path") >= 2),
	CONSTRAINT "routes_coordinates_check" CHECK ("routes"."start_latitude" between -90 and 90 and "routes"."start_longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "routes_name_unique" ON "routes" USING btree ("name");