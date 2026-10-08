CREATE TABLE "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suite" varchar(16) NOT NULL,
	"workflow" varchar(64) NOT NULL,
	"trigger" varchar(32),
	"scope" varchar(256),
	"branch" varchar(256),
	"commit_sha" varchar(40),
	"run_id" varchar(32) NOT NULL,
	"run_attempt" integer DEFAULT 1 NOT NULL,
	"run_url" varchar(512),
	"total" integer NOT NULL,
	"passed" integer NOT NULL,
	"failed" integer NOT NULL,
	"flaky" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"failures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_runs_suite_check" CHECK ("test_runs"."suite" IN ('backend', 'e2e'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "test_runs_run_suite_idx" ON "test_runs" USING btree ("run_id","run_attempt","suite");--> statement-breakpoint
CREATE INDEX "test_runs_created_idx" ON "test_runs" USING btree ("created_at");