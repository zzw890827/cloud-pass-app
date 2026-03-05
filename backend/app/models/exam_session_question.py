from typing import Optional, TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.exam_session import ExamSession
    from app.models.question import Question


class ExamSessionQuestion(Base):
    __tablename__ = "exam_session_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("exam_sessions.id"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    selected_option_ids: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array string
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    session: Mapped["ExamSession"] = relationship(back_populates="questions")
    question: Mapped["Question"] = relationship()
