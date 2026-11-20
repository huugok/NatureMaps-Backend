CREATE TABLE "offline_maps" (
	"code" text PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"byte_length" integer NOT NULL,
	"bounds" jsonb NOT NULL,
	"min_zoom" integer NOT NULL,
	"max_zoom" integer NOT NULL,
	"source_url" text NOT NULL,
	"archive_base64" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offline_maps_size_check" CHECK ("offline_maps"."byte_length" between 127 and 33554432),
	CONSTRAINT "offline_maps_zoom_check" CHECK ("offline_maps"."min_zoom" >= 0 and "offline_maps"."max_zoom" between "offline_maps"."min_zoom" and 22),
	CONSTRAINT "offline_maps_hash_check" CHECK ("offline_maps"."sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "offline_maps_bounds_check" CHECK (jsonb_typeof("offline_maps"."bounds") = 'array' and jsonb_array_length("offline_maps"."bounds") = 4)
);
