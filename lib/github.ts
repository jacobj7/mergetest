const GITHUB_API_BASE = "https://api.github.com";

export interface PRDiff {
  files: PRFile[];
  title: string;
  body: string | null;
  head: {
    sha: string;
    ref: string;
  };
  base: {
    sha: string;
    ref: string;
  };
  number: number;
  state: string;
  user: {
    login: string;
  };
}

export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url: string;
  raw_url: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export type StatusState = "error" | "failure" | "pending" | "success";

export interface StatusCheck {
  id: number;
  state: StatusState;
  description: string;
  context: string;
  target_url?: string;
  created_at: string;
  updated_at: string;
}

async function githubFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${GITHUB_API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} - ${errorBody}`,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchPRDiff(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
): Promise<PRDiff> {
  const [prData, filesData] = await Promise.all([
    githubFetch<{
      title: string;
      body: string | null;
      number: number;
      state: string;
      head: { sha: string; ref: string };
      base: { sha: string; ref: string };
      user: { login: string };
    }>(`/repos/${owner}/${repo}/pulls/${prNumber}`, token),
    githubFetch<PRFile[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      token,
    ),
  ]);

  return {
    title: prData.title,
    body: prData.body,
    number: prData.number,
    state: prData.state,
    head: prData.head,
    base: prData.base,
    user: prData.user,
    files: filesData,
  };
}

export async function postStatusCheck(
  owner: string,
  repo: string,
  sha: string,
  state: StatusState,
  description: string,
  token: string,
  options?: {
    context?: string;
    targetUrl?: string;
  },
): Promise<StatusCheck> {
  const body: Record<string, string> = {
    state,
    description,
    context: options?.context ?? "ai-code-review",
  };

  if (options?.targetUrl) {
    body.target_url = options.targetUrl;
  }

  return githubFetch<StatusCheck>(
    `/repos/${owner}/${repo}/statuses/${sha}`,
    token,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function listUserRepos(
  token: string,
  options?: {
    type?: "all" | "owner" | "public" | "private" | "member";
    sort?: "created" | "updated" | "pushed" | "full_name";
    direction?: "asc" | "desc";
    perPage?: number;
    page?: number;
  },
): Promise<Repository[]> {
  const params = new URLSearchParams({
    type: options?.type ?? "owner",
    sort: options?.sort ?? "updated",
    direction: options?.direction ?? "desc",
    per_page: String(options?.perPage ?? 30),
    page: String(options?.page ?? 1),
  });

  return githubFetch<Repository[]>(`/user/repos?${params.toString()}`, token);
}

export async function fetchPRComments(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
): Promise<
  Array<{
    id: number;
    body: string;
    user: { login: string };
    created_at: string;
    path?: string;
    line?: number;
  }>
> {
  return githubFetch(
    `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
    token,
  );
}

export async function postPRComment(
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  token: string,
): Promise<{ id: number; body: string; html_url: string }> {
  return githubFetch(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  );
}

export async function fetchRepoDetails(
  owner: string,
  repo: string,
  token: string,
): Promise<Repository> {
  return githubFetch<Repository>(`/repos/${owner}/${repo}`, token);
}

export async function listPullRequests(
  owner: string,
  repo: string,
  token: string,
  options?: {
    state?: "open" | "closed" | "all";
    perPage?: number;
    page?: number;
  },
): Promise<
  Array<{
    number: number;
    title: string;
    state: string;
    user: { login: string; avatar_url: string };
    head: { sha: string; ref: string };
    base: { sha: string; ref: string };
    created_at: string;
    updated_at: string;
    html_url: string;
  }>
> {
  const params = new URLSearchParams({
    state: options?.state ?? "open",
    per_page: String(options?.perPage ?? 30),
    page: String(options?.page ?? 1),
  });

  return githubFetch(
    `/repos/${owner}/${repo}/pulls?${params.toString()}`,
    token,
  );
}
