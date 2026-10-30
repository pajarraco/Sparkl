CREATE TABLE "job_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"cleaner_id" text NOT NULL,
	"initiated_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_cleaner_id_user_id_fk" FOREIGN KEY ("cleaner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_requests_job_idx" ON "job_requests" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_requests_cleaner_idx" ON "job_requests" USING btree ("cleaner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_requests_job_cleaner_pending_unique" ON "job_requests" USING btree ("job_id","cleaner_id") WHERE "job_requests"."status" = 'pending';