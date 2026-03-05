from typing import Optional

from pydantic import BaseModel


class ExamResponse(BaseModel):
    id: int
    provider_id: int
    code: str
    name: str
    description: Optional[str] = None
    total_questions: int
    is_active: bool
    provider_name: str = ""
    num_questions: int = 65
    pass_percentage: int = 75
    time_limit_minutes: int = 180

    model_config = {"from_attributes": True}


class ExamDetailResponse(ExamResponse):
    progress_summary: Optional["ProgressSummary"] = None
    active_session_id: Optional[int] = None


class ProgressSummary(BaseModel):
    total: int = 0
    attempted: int = 0
    correct: int = 0
    incorrect: int = 0
    bookmarked: int = 0
