import { z } from "zod";

export const jobStatusSchema = z.enum([
  "open",
  "claimed",
  "in_progress",
  "completed",
  "cancelled",
]);

export type JobStatus = z.infer<typeof jobStatusSchema>;

export const JOB_STATUS = {
  OPEN: "open",
  CLAIMED: "claimed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const satisfies Record<string, JobStatus>;

export const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  open: ["claimed", "cancelled"],
  claimed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
