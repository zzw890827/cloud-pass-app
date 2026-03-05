from typing import List, Optional, TYPE_CHECKING

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.exam import Exam
    from app.models.exam_session_question import ExamSessionQuestion


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")  # in_progress, completed, abandoned

    # Config snapshot (copied from exam at creation time)
    num_questions: Mapped[int] = mapped_column(Integer)
    pass_percentage: Mapped[int] = mapped_column(Integer)
    time_limit_minutes: Mapped[int] = mapped_column(Integer)

    # Results (filled on completion)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    correct_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_answered: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    passed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()
    exam: Mapped["Exam"] = relationship(back_populates="sessions")
    questions: Mapped[List["ExamSessionQuestion"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ExamSessionQuestion.order_index"
    )
