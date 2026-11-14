CREATE TABLE "reaction_role_options" (
	"panel_id" text NOT NULL,
	"position" integer NOT NULL,
	"emoji" text NOT NULL,
	"role_id" text NOT NULL,
	CONSTRAINT "reaction_role_options_panel_id_position_pk" PRIMARY KEY("panel_id","position")
);
--> statement-breakpoint
CREATE TABLE "reaction_role_panels" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text,
	"single_reaction" boolean DEFAULT false NOT NULL,
	"embed" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reaction_role_options" ADD CONSTRAINT "reaction_role_options_panel_id_reaction_role_panels_id_fk" FOREIGN KEY ("panel_id") REFERENCES "reaction_role_panels"("id") ON DELETE cascade ON UPDATE no action;