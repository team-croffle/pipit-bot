CREATE TABLE "music_banners" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
