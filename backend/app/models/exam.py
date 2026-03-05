from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.provider import Provider
    from app.models.question import Question
    from app.models.exam_session import ExamSession


class Exam(Base, TimestampMixin):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    num_questions: Mapped[int] = mapped_column(Integer, default=65)
    pass_percentage: Mapped[int] = mapped_column(Integer, default=75)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, default=180)

    provider: Mapped["Provider"] = relationship(back_populates="exams")
    questions: Mapped[List["Question"]] = relationship(back_populates="exam", cascade="all, delete-orphan")
    sessions: Mapped[List["ExamSession"]] = relationship(back_populates="exam", cascade="all, delete-orphan")
