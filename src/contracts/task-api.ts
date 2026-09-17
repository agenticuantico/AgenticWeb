export type TaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface CreateTaskPayload {
  objective: string;
  permissions: string[];
  budget: {
    maxSteps: number;
    maxRuntimeSeconds: number;
    maxToolCalls: number;
  };
}

export interface TaskStatusResponse {
  taskId: string;
  status: TaskStatus;
  summary?: string;
  traceId: string;
  errorCode?: string;
}

/**
 * Client-side contract only. Authentication, authorization and validation
 * remain mandatory on the private backend.
 */
export interface TaskApiClient {
  createTask(payload: CreateTaskPayload): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<TaskStatusResponse>;
  cancelTask(taskId: string): Promise<void>;
}
