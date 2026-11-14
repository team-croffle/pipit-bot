CREATE TABLE "file_migrations" (
	"name" text PRIMARY KEY NOT NULL,
	"items" integer NOT NULL,
	"migrated_at" timestamp with time zone DEFAULT now() NOT NULL
);
