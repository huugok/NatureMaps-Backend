CREATE TABLE "data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"license" text NOT NULL,
	"license_url" text NOT NULL,
	"attribution" text NOT NULL,
	"logo_url" text,
	"last_downloaded_at" timestamp with time zone,
	CONSTRAINT "data_sources_text_check" CHECK (length(trim("data_sources"."code")) > 0 and length(trim("data_sources"."provider")) > 0 and length(trim("data_sources"."name")) > 0 and length(trim("data_sources"."url")) > 0 and length(trim("data_sources"."license")) > 0 and length(trim("data_sources"."license_url")) > 0 and length(trim("data_sources"."attribution")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "data_sources_code_unique" ON "data_sources" USING btree ("code");