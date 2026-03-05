from typing import List, Optional

from pydantic import BaseModel


class ProviderResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    exam_count: int = 0

    model_config = {"from_attributes": True}


class ProviderDetailResponse(ProviderResponse):
    exams: List["ExamBriefResponse"] = []


class ExamBriefResponse(BaseModel):
    id: int
    code: str
    name: str
    total_questions: int
    is_active: bool

    model_config = {"from_attributes": True}
