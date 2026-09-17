export interface SkillSummary {
  id: string;
  version: string;
  description: string;
  capabilities: string[];
  requiresApproval: boolean;
}

export interface SkillsApiClient {
  listSkills(): Promise<SkillSummary[]>;
  getSkill(id: string): Promise<SkillSummary>;
  requestSkillExecution(id: string, input: unknown): Promise<{ taskId: string }>;
}

/** UI contract only. The backend remains the authority for permissions,
 * secrets, validation, execution and approval decisions. */
