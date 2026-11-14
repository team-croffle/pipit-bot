CREATE TABLE "audit_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"target" text,
	"outcome" text NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE INDEX "audit_entries_at" ON "audit_entries" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_entries_category_at" ON "audit_entries" USING btree ("category","at");