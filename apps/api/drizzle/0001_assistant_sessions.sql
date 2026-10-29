CREATE TABLE "assistant_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"job_id" text,
	"model" text,
	"turns" integer DEFAULT 0 NOT NULL,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"model_filled" text[] DEFAULT '{}'::text[] NOT NULL,
	"host_changed" text[] DEFAULT '{}'::text[] NOT NULL,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assistant_sessions" ADD CONSTRAINT "assistant_sessions_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_sessions" ADD CONSTRAINT "assistant_sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_sessions_host_idx" ON "assistant_sessions" USING btree ("host_id","created_at");