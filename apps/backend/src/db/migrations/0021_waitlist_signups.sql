CREATE TABLE "waitlist_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" varchar(16) NOT NULL,
	"source_cta" varchar(64),
	"utm_source" varchar(128),
	"utm_medium" varchar(128),
	"utm_campaign" varchar(128),
	"utm_term" varchar(128),
	"utm_content" varchar(128),
	"unsubscribe_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"resend_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_signups_unsubscribe_token_unique" UNIQUE("unsubscribe_token"),
	CONSTRAINT "waitlist_signups_role_check" CHECK ("waitlist_signups"."role" IN ('seeker', 'referrer'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_signups_email_role_idx" ON "waitlist_signups" USING btree ("email","role");--> statement-breakpoint
CREATE INDEX "waitlist_signups_role_idx" ON "waitlist_signups" USING btree ("role");