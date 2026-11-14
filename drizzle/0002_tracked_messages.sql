CREATE TABLE "tracked_messages" (
	"key" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"toggle" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"mentioned" text[] DEFAULT '{}' NOT NULL
);
