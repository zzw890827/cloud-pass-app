from typing import List

from pydantic import BaseModel

from app.schemas.exam import ProgressSummary


class ProgressDetailItem(BaseModel):
    question_id: int
    external_id: str
    is_correct: bool
    selected_option_ids: List[int]


class ProgressDetailResponse(BaseModel):
    summary: ProgressSummary
    items: List[ProgressDetailItem]
