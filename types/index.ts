export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  githubUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Repository {
  id: string;
  userId: string;
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  githubId: number;
  htmlUrl: string;
  cloneUrl: string;
  createdAt: Date;
  updatedAt: Date;
  lastAnalyzedAt: Date | null;
}

export interface PRAnalysis {
  id: string;
  repositoryId: string;
  userId: string;
  prNumber: number;
  prTitle: string;
  prDescription: string | null;
  prAuthor: string;
  prUrl: string;
  baseBranch: string;
  headBranch: string;
  diffContent: string | null;
  filesChanged: number;
  additions: number;
  deletions: number;
  status: AnalysisStatus;
  summary: string | null;
  codeQualityScore: number | null;
  securityScore: number | null;
  performanceScore: number | null;
  maintainabilityScore: number | null;
  overallScore: number | null;
  issues: AnalysisIssue[];
  suggestions: AnalysisSuggestion[];
  rawAnalysis: string | null;
  modelUsed: string | null;
  tokensUsed: number | null;
  analysisStartedAt: Date | null;
  analysisCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AnalysisStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface AnalysisIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  suggestion: string | null;
  codeSnippet: string | null;
}

export type IssueSeverity = "critical" | "high" | "medium" | "low" | "info";

export type IssueCategory =
  | "security"
  | "performance"
  | "maintainability"
  | "code_quality"
  | "best_practices"
  | "documentation"
  | "testing"
  | "accessibility"
  | "other";

export interface AnalysisSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  priority: SuggestionPriority;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  originalCode: string | null;
  suggestedCode: string | null;
  explanation: string | null;
}

export type SuggestionType =
  | "refactor"
  | "optimization"
  | "security_fix"
  | "style"
  | "documentation"
  | "test_coverage"
  | "dependency_update"
  | "other";

export type SuggestionPriority = "high" | "medium" | "low";

export interface AnalysisJob {
  id: string;
  repositoryId: string;
  userId: string;
  prAnalysisId: string | null;
  jobType: JobType;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  errorStack: string | null;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type JobType = "pr_analysis" | "repository_scan" | "batch_analysis";

export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "retrying";

export interface DashboardStats {
  totalRepositories: number;
  totalAnalyses: number;
  completedAnalyses: number;
  pendingAnalyses: number;
  failedAnalyses: number;
  averageOverallScore: number | null;
  averageCodeQualityScore: number | null;
  averageSecurityScore: number | null;
  averagePerformanceScore: number | null;
  averageMaintainabilityScore: number | null;
  totalIssuesFound: number;
  criticalIssuesFound: number;
  highIssuesFound: number;
  mediumIssuesFound: number;
  lowIssuesFound: number;
  analysesThisWeek: number;
  analysesThisMonth: number;
  mostActiveRepository: string | null;
  lastAnalysisAt: Date | null;
}

export interface TrendDataPoint {
  date: string;
  analysisCount: number;
  averageScore: number | null;
  issueCount: number;
  criticalIssueCount: number;
  repositoryId: string | null;
  repositoryName: string | null;
}

export interface RepositoryWithStats extends Repository {
  totalAnalyses: number;
  lastAnalysis: PRAnalysis | null;
  averageScore: number | null;
}

export interface PRAnalysisWithRepository extends PRAnalysis {
  repository: Repository;
}

export interface AnalysisJobWithDetails extends AnalysisJob {
  repository: Repository;
  prAnalysis: PRAnalysis | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  base: {
    ref: string;
    sha: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  state: "open" | "closed" | "merged";
  draft: boolean;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ScoreBreakdown {
  codeQuality: number | null;
  security: number | null;
  performance: number | null;
  maintainability: number | null;
  overall: number | null;
}

export interface AnalysisSummary {
  totalIssues: number;
  issuesBySeverity: Record<IssueSeverity, number>;
  issuesByCategory: Record<IssueCategory, number>;
  totalSuggestions: number;
  suggestionsByType: Record<SuggestionType, number>;
  scores: ScoreBreakdown;
  highlights: string[];
  concerns: string[];
}
