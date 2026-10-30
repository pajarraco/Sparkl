CREATE TABLE "assistant_solution_events" (
	"id" text PRIMARY KEY NOT NULL,
	"solution_id" text NOT NULL,
	"session_id" text NOT NULL,
	"host_id" text NOT NULL,
	"event" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_solutions" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"host_id" text,
	"kind" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"payload" jsonb NOT NULL,
	"fingerprint" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"proposed" integer DEFAULT 0 NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"score" double precision DEFAULT 0 NOT NULL,
	"last_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_solution_events" ADD CONSTRAINT "assistant_solution_events_solution_id_assistant_solutions_id_fk" FOREIGN KEY ("solution_id") REFERENCES "public"."assistant_solutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_solution_events" ADD CONSTRAINT "assistant_solution_events_session_id_assistant_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assistant_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_solution_events" ADD CONSTRAINT "assistant_solution_events_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_solutions" ADD CONSTRAINT "assistant_solutions_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_solution_events_once_unique" ON "assistant_solution_events" USING btree ("solution_id","session_id","event");--> statement-breakpoint
CREATE INDEX "assistant_solution_events_host_idx" ON "assistant_solution_events" USING btree ("host_id","solution_id");--> statement-breakpoint
CREATE INDEX "assistant_solutions_kind_status_idx" ON "assistant_solutions" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "assistant_solutions_tags_idx" ON "assistant_solutions" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_solutions_host_fingerprint_unique" ON "assistant_solutions" USING btree ("host_id","fingerprint") WHERE "assistant_solutions"."scope" = 'host';--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_solutions_global_fingerprint_unique" ON "assistant_solutions" USING btree ("fingerprint") WHERE "assistant_solutions"."scope" = 'global';