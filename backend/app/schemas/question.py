from typing import List, Optional

from pydantic import BaseModel


class OptionResponse(BaseModel):
    id: int
    label: str
    option_text: str

    model_config = {"from_attributes": True}


class OptionWithAnswerResponse(OptionResponse):
    is_correct: bool


class QuestionListItem(BaseModel):
    id: int
    external_id: str
    question_type: str
    num_correct: int
    order_index: int
    is_attempted: bool = False
    is_correct: Optional[bool] = None
    is_bookmarked: bool = False

    model_config = {"from_attributes": True}


class QuestionResponse(BaseModel):
    id: int
    external_id: str
    question_text: str
    question_type: str
    num_correct: int
    order_index: int
    options: List[OptionResponse]
    is_bookmarked: bool = False
    user_progress: Optional["UserProgressBrief"] = None

    model_config = {"from_attributes": True}


class UserProgressBrief(BaseModel):
    is_correct: bool
    selected_option_ids: List[int]


class SubmitAnswerRequest(BaseModel):
    selected_option_ids: List[int]


class SubmitAnswerResponse(BaseModel):
    is_correct: bool
    correct_option_ids: List[int]
    explanation: Optional[str] = None
    options: List[OptionWithAnswerResponse]


class QuestionPage(BaseModel):
    items: List[QuestionListItem]
    total: int
    page: int
    per_page: int
    total_pages: int
