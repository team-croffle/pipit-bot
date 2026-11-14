CREATE TABLE "playlist_items" (
	"playlist_id" text NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"duration_sec" integer,
	"request" text NOT NULL,
	"typed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "playlist_items_playlist_id_id_pk" PRIMARY KEY("playlist_id","id")
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"owner_id" text,
	"created_by_id" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE cascade ON UPDATE no action;