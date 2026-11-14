CREATE TABLE "invite_stats" (
	"code" text PRIMARY KEY NOT NULL,
	"joins" integer NOT NULL,
	"inviter_id" text,
	"last_join_at" text NOT NULL
);
