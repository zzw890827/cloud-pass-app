from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import Exam, ExamSession, Provider, User
from app.schemas.exam import ExamDetailResponse, ExamResponse
from app.services.progress_service import get_progress_summary

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("", response_model=List[ExamResponse])
async def list_exams(provider_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    query = select(Exam, Provider.name).join(Provider, Exam.provider_id == Provider.id)
    if provider_id:
        query = query.where(Exam.provider_id == provider_id)
    query = query.order_by(Exam.code)

    result = await db.execute(query)
    return [
        ExamResponse(
            id=exam.id,
            provider_id=exam.provider_id,
            code=exam.code,
            name=exam.name,
            description=exam.description,
            total_questions=exam.total_questions,
            is_active=exam.is_active,
            provider_name=provider_name,
            num_questions=exam.num_questions,
            pass_percentage=exam.pass_percentage,
            time_limit_minutes=exam.time_limit_minutes,
        )
        for exam, provider_name in result.all()
    ]


@router.get("/{exam_id}", response_model=ExamDetailResponse)
async def get_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Exam, Provider.name).join(Provider, Exam.provider_id == Provider.id).where(Exam.id == exam_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    exam, provider_name = row
    summary = await get_progress_summary(db, exam_id, user.id)

    # Check for active exam session
    active_result = await db.execute(
        select(ExamSession.id).where(
            ExamSession.user_id == user.id,
            ExamSession.exam_id == exam_id,
            ExamSession.status == "in_progress",
        )
    )
    active_row = active_result.scalar_one_or_none()

    return ExamDetailResponse(
        id=exam.id,
        provider_id=exam.provider_id,
        code=exam.code,
        name=exam.name,
        description=exam.description,
        total_questions=exam.total_questions,
        is_active=exam.is_active,
        provider_name=provider_name,
        num_questions=exam.num_questions,
        pass_percentage=exam.pass_percentage,
        time_limit_minutes=exam.time_limit_minutes,
        progress_summary=summary,
        active_session_id=active_row,
    )
