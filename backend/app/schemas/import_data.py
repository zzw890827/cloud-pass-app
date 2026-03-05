from typing import List, Optional

from pydantic import BaseModel


class ImportOption(BaseModel):
    label: str
    text: str
    is_correct: bool


class ImportQuestion(BaseModel):
    external_id: str
    question_text: str
    question_type: str  # single | multi
    explanation: Optional[str] = None
    options: List[ImportOption]


class ImportProvider(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None


class ImportExam(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class ImportPayload(BaseModel):
    provider: ImportProvider
    exam: ImportExam
    questions: List[ImportQuestion]


class ImportResult(BaseModel):
    provider_id: int
    exam_id: int
    questions_imported: int
    questions_skipped: int
