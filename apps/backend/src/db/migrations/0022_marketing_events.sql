CREATE TABLE "marketing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(16) NOT NULL,
	"cta" varchar(64),
	"role" varchar(16),
	"path" varchar(256),
	"utm_source" varchar(128),
	"utm_medium" varchar(128),
	"utm_campaign" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_events_type_check" CHECK ("marketing_events"."type" IN ('page_view', 'cta_click'))
);
--> statement-breakpoint
CREATE INDEX "marketing_events_type_created_idx" ON "marketing_events" USING btree ("type","created_at");