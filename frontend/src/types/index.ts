// Auth
export interface User {
  id: number;
  email: string;
  display_name: string;
  is_active: boolean;
  is_admin: boolean;
}

// Provider
export interface Provider {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  exam_count: number;
}

export interface ProviderDetail extends Provider {
  exams: ExamBrief[];
}

export interface ExamBrief {
  id: number;
  code: string;
  name: string;
  total_questions: number;
  is_active: boolean;
}

// Exam
export interface Exam {
  id: number;
  provider_id: number;
  code: string;
  name: string;
  description: string | null;
  total_questions: number;
  is_active: boolean;
  provider_name: string;
  num_questions: number;
  pass_percentage: number;
  time_limit_minutes: number;
  progress_summary?: ProgressSummary;
  active_session_id?: number | null;
}

export interface ProgressSummary {
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  bookmarked: number;
}

// Question
export interface Option {
  id: number;
  label: string;
  option_text: string;
}

export interface OptionWithAnswer extends Option {
  is_correct: boolean;
}

export interface QuestionListItem {
  id: number;
  external_id: string;
  question_type: string;
  num_correct: number;
  order_index: number;
  is_attempted: boolean;
  is_correct: boolean | null;
  is_bookmarked: boolean;
}

export interface Question {
  id: number;
  external_id: string;
  question_text: string;
  question_type: string;
  num_correct: number;
  order_index: number;
  options: Option[];
  is_bookmarked: boolean;
  user_progress: UserProgressBrief | null;
}

export interface UserProgressBrief {
  is_correct: boolean;
  selected_option_ids: number[];
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_option_ids: number[];
  explanation: string | null;
  options: OptionWithAnswer[];
}

export interface QuestionPage {
  items: QuestionListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Bookmark
export interface Bookmark {
  id: number;
  question_id: number;
  created_at: string;
  question_text: string;
  question_type: string;
  exam_id: number;
  exam_code?: string;
}

// Progress
export interface ProgressDetail {
  summary: ProgressSummary;
  items: ProgressDetailItem[];
}

export interface ProgressDetailItem {
  question_id: number;
  external_id: string;
  is_correct: boolean;
  selected_option_ids: number[];
}

// Import
export interface ImportResult {
  provider_id: number;
  exam_id: number;
  questions_imported: number;
  questions_skipped: number;
}

// Exam Session
export interface ExamSessionQuestionListItem {
  id: number;
  question_id: number;
  order_index: number;
  is_answered: boolean;
  is_correct: boolean | null;
}

export interface SessionOption {
  id: number;
  label: string;
  option_text: string;
}

export interface ExamSessionQuestionDetail {
  session_question_id: number;
  question_id: number;
  order_index: number;
  external_id: string;
  question_text: string;
  question_type: string;
  num_correct: number;
  options: SessionOption[];
  selected_option_ids: number[] | null;
  is_correct: boolean | null;
}

export interface ExamSession {
  id: number;
  exam_id: number;
  exam_code: string;
  exam_name: string;
  status: string;
  num_questions: number;
  pass_percentage: number;
  time_limit_minutes: number;
  paused_at: string | null;
  elapsed_seconds: number;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  questions: ExamSessionQuestionListItem[];
}

export interface SessionQuestionResultOption {
  id: number;
  label: string;
  option_text: string;
  is_correct: boolean;
}

export interface SessionQuestionResult {
  question_id: number;
  external_id: string;
  question_text: string;
  question_type: string;
  is_correct: boolean | null;
  selected_option_ids: number[] | null;
  options: SessionQuestionResultOption[];
}

export interface ExamSessionResult {
  id: number;
  exam_id: number;
  exam_code: string;
  exam_name: string;
  status: string;
  num_questions: number;
  pass_percentage: number;
  time_limit_minutes: number;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  correct_count: number | null;
  total_answered: number | null;
  passed: boolean | null;
  question_results: SessionQuestionResult[];
}

export interface ExamSessionHistoryItem {
  id: number;
  status: string;
  score: number | null;
  correct_count: number | null;
  total_answered: number | null;
  passed: boolean | null;
  num_questions: number;
  pass_percentage: number;
  started_at: string;
  completed_at: string | null;
}

export interface ExamSessionHistory {
  exam_id: number;
  exam_code: string;
  exam_name: string;
  items: ExamSessionHistoryItem[];
}

export interface QuestionErrorFrequency {
  question_id: number;
  external_id: string;
  error_count: number;
  attempt_count: number;
  error_rate: number;
}

export interface ExamErrorReport {
  exam_id: number;
  items: QuestionErrorFrequency[];
}
