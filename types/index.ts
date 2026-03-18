export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface Org {
  id: string;
  name: string;
  githubInstallationId: string | null;
  githubOrgLogin: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  name: string | null;
  githubLogin: string | null;
  avatarUrl: string | null;
  role: "admin" | "member" | "viewer";
  createdAt: Date;
  updatedAt: Date;
}

export interface Repo {
  id: string;
  orgId: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  language: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PullRequest {
  id: string;
  repoId: string;
  orgId: string;
  githubPrNumber: number;
  title: string;
  body: string | null;
  authorLogin: string;
  authorAvatarUrl: string | null;
  baseBranch: string;
  headBranch: string;
  state: "open" | "closed" | "merged";
  isDraft: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergedAt: Date | null;
  closedAt: Date | null;
  githubCreatedAt: Date;
  githubUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PRAnalysis {
  id: string;
  pullRequestId: string;
  orgId: string;
  riskLevel: RiskLevel;
  riskScore: number;
  summary: string;
  keyChanges: string[];
  potentialIssues: string[];
  suggestions: string[];
  securityConcerns: string[];
  testingRecommendations: string[];
  complexityScore: number;
  estimatedReviewTime: number;
  rawResponse: string | null;
  modelVersion: string;
  promptTokens: number;
  completionTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisJob {
  id: string;
  pullRequestId: string;
  orgId: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PullRequestWithAnalysis extends PullRequest {
  analysis: PRAnalysis | null;
  repo: Repo;
}

export interface OrgWithUsers extends Org {
  users: User[];
}

export interface RepoWithPRs extends Repo {
  pullRequests: PullRequest[];
}

export interface AnalysisJobWithPR extends AnalysisJob {
  pullRequest: PullRequest;
}

export interface DashboardStats {
  totalPRs: number;
  analyzedPRs: number;
  pendingAnalysis: number;
  riskDistribution: Record<RiskLevel, number>;
  averageRiskScore: number;
  averageReviewTime: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
}
