from typing import List, Optional

from datetime import datetime

from pydantic import BaseModel


# --- Requests ---

class CreateExamSessionRequest(BaseModel):
    exam_id: int


class SubmitSessionAnswerRequest(BaseModel):
    selected_option_ids: List[int]


# --- Question schemas ---

class ExamSessionQuestionListItem(BaseModel):
    id: int
    question_id: int
    order_index: int
    is_answered: bool = False
    is_correct: Optional[bool] = None

    model_config = {"from_attributes": True}


class SessionOptionResponse(BaseModel):
    id: int
    label: str
    option_text: str

    model_config = {"from_attributes": True}


class ExamSessionQuestionDetail(BaseModel):
    session_question_id: int
    question_id: int
    order_index: int
    external_id: str
    question_text: str
    question_type: str
    num_correct: int
    options: List[SessionOptionResponse]
    selected_option_ids: Optional[List[int]] = None
    is_correct: Optional[bool] = None

    model_config = {"from_attributes": True}


class SubmitSessionAnswerResponse(BaseModel):
    is_answered: bool


# --- Session schemas ---

class ExamSessionResponse(BaseModel):
    id: int
    exam_id: int
    exam_code: str = ""
    exam_name: str = ""
    status: str
    num_questions: int
    pass_percentage: int
    time_limit_minutes: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    score: Optional[float] = None
    questions: List[ExamSessionQuestionListItem] = []

    model_config = {"from_attributes": True}


# --- Result schemas ---

class SessionQuestionResult(BaseModel):
    question_id: int
    external_id: str
    is_correct: Optional[bool] = None
    selected_option_ids: Optional[List[int]] = None


class ExamSessionResultResponse(BaseModel):
    id: int
    exam_id: int
    exam_code: str = ""
    exam_name: str = ""
    status: str
    num_questions: int
    pass_percentage: int
    time_limit_minutes: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    score: Optional[float] = None
    correct_count: Optional[int] = None
    total_answered: Optional[int] = None
    passed: Optional[bool] = None
    question_results: List[SessionQuestionResult] = []

    model_config = {"from_attributes": True}


# --- History schemas ---

class ExamSessionHistoryItem(BaseModel):
    id: int
    status: str
    score: Optional[float] = None
    correct_count: Optional[int] = None
    total_answered: Optional[int] = None
    passed: Optional[bool] = None
    num_questions: int
    pass_percentage: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ExamSessionHistoryResponse(BaseModel):
    exam_id: int
    exam_code: str
    exam_name: str
    items: List[ExamSessionHistoryItem] = []


# --- Error report schemas ---

class QuestionErrorFrequency(BaseModel):
    question_id: int
    external_id: str
    error_count: int
    attempt_count: int
    error_rate: float


class ExamErrorReportResponse(BaseModel):
    exam_id: int
    items: List[QuestionErrorFrequency] = []
