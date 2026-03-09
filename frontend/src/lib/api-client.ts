const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787/api/v1";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // In dev mode, send dev user email header
  if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
    headers["X-Dev-User-Email"] = process.env.NEXT_PUBLIC_DEV_USER_EMAIL || "dev@example.com";
  }

  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    // credentials: "include" sends CF Access cookie in production
    // In dev mode, auth is via X-Dev-User-Email header instead
    ...(isDevMode ? {} : { credentials: "include" as RequestCredentials }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new ApiError(res.status, body.detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  me: () => request<import("@/types").User>("/auth/me"),

  // Providers
  getProviders: () => request<import("@/types").Provider[]>("/providers"),
  getProvider: (id: number) =>
    request<import("@/types").ProviderDetail>(`/providers/${id}`),

  // Exams
  getExams: (providerId?: number) =>
    request<import("@/types").Exam[]>(
      `/exams${providerId ? `?provider_id=${providerId}` : ""}`
    ),
  getExam: (id: number) => request<import("@/types").Exam>(`/exams/${id}`),

  // Questions
  getQuestions: (examId: number, page = 1, perPage = 50) =>
    request<import("@/types").QuestionPage>(
      `/exams/${examId}/questions?page=${page}&per_page=${perPage}`
    ),
  getQuestion: (id: number) =>
    request<import("@/types").Question>(`/questions/${id}`),
  submitAnswer: (id: number, selectedOptionIds: number[]) =>
    request<import("@/types").SubmitAnswerResponse>(
      `/questions/${id}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ selected_option_ids: selectedOptionIds }),
      }
    ),

  // Bookmarks
  addBookmark: (questionId: number) =>
    request(`/questions/${questionId}/bookmark`, { method: "POST" }),
  removeBookmark: (questionId: number) =>
    request(`/questions/${questionId}/bookmark`, { method: "DELETE" }),
  getBookmarks: (examId?: number) =>
    request<import("@/types").Bookmark[]>(
      `/bookmarks${examId ? `?exam_id=${examId}` : ""}`
    ),

  // Progress
  getProgress: (examId: number) =>
    request<import("@/types").ProgressDetail>(`/exams/${examId}/progress`),
  resetProgress: (examId: number) =>
    request(`/exams/${examId}/progress`, { method: "DELETE" }),

  // Exam Sessions
  createExamSession: (examId: number) =>
    request<import("@/types").ExamSession>("/exam-sessions", {
      method: "POST",
      body: JSON.stringify({ exam_id: examId }),
    }),
  getActiveSession: (examId: number) =>
    request<import("@/types").ExamSession | null>(
      `/exam-sessions/active?exam_id=${examId}`
    ),
  getExamSession: (sessionId: number) =>
    request<import("@/types").ExamSession>(`/exam-sessions/${sessionId}`),
  getSessionQuestion: (sessionId: number, orderIndex: number) =>
    request<import("@/types").ExamSessionQuestionDetail>(
      `/exam-sessions/${sessionId}/questions/${orderIndex}`
    ),
  submitSessionAnswer: (sessionId: number, orderIndex: number, selectedOptionIds: number[]) =>
    request<{ is_answered: boolean }>(
      `/exam-sessions/${sessionId}/questions/${orderIndex}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ selected_option_ids: selectedOptionIds }),
      }
    ),
  completeExamSession: (sessionId: number) =>
    request<import("@/types").ExamSessionResult>(
      `/exam-sessions/${sessionId}/complete`,
      { method: "POST" }
    ),
  pauseExamSession: (sessionId: number) =>
    request<import("@/types").ExamSession>(
      `/exam-sessions/${sessionId}/pause`,
      { method: "POST" }
    ),
  resumeExamSession: (sessionId: number) =>
    request<import("@/types").ExamSession>(
      `/exam-sessions/${sessionId}/resume`,
      { method: "POST" }
    ),
  abandonExamSession: (sessionId: number) =>
    request<void>(`/exam-sessions/${sessionId}/abandon`, { method: "POST" }),
  getSessionResult: (sessionId: number) =>
    request<import("@/types").ExamSessionResult>(
      `/exam-sessions/${sessionId}/result`
    ),
  getSessionHistory: (examId: number) =>
    request<import("@/types").ExamSessionHistory>(
      `/exam-sessions/history?exam_id=${examId}`
    ),
  getErrorReport: (examId: number) =>
    request<import("@/types").ExamErrorReport>(
      `/exam-sessions/error-report?exam_id=${examId}`
    ),

  // Admin
  importData: (data: unknown) =>
    request<import("@/types").ImportResult>("/admin/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export { ApiError };
