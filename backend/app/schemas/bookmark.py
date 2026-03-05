from datetime import datetime

from pydantic import BaseModel


class BookmarkResponse(BaseModel):
    id: int
    question_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class BookmarkWithQuestion(BookmarkResponse):
    question_text: str = ""
    question_type: str = ""
    exam_id: int = 0
    exam_code: str = ""
