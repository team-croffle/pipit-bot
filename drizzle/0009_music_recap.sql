CREATE TABLE "music_plays" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "music_plays_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"started_at" timestamp with time zone NOT NULL,
	"guild_id" text NOT NULL,
	"file_key" text NOT NULL,
	"title" text NOT NULL,
	"duration_sec" integer,
	"played_sec" integer DEFAULT 0 NOT NULL,
	"end_reason" text,
	"origin" text NOT NULL,
	"requester_id" text
);
--> statement-breakpoint
CREATE TABLE "music_recaps" (
	"guild_id" text NOT NULL,
	"period" text NOT NULL,
	"kind" text NOT NULL,
	"summary" jsonb NOT NULL,
	"channel_id" text,
	"message_id" text,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "music_recaps_guild_id_period_pk" PRIMARY KEY("guild_id","period")
);
--> statement-breakpoint
CREATE TABLE "music_tracks" (
	"file_key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"duration_sec" integer,
	"request" text,
	"last_played_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "music_plays_guild_started" ON "music_plays" USING btree ("guild_id","started_at");--> statement-breakpoint
CREATE INDEX "music_plays_requester_started" ON "music_plays" USING btree ("requester_id","started_at");