from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.progress import ProgressDetailResponse
from app.services import progress_service

router = APIRouter(tags=["progress"])


@router.get("/exams/{exam_id}/progress", response_model=ProgressDetailResponse)
async def get_progress(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await progress_service.get_progress_detail(db, exam_id, user.id)


@router.delete("/exams/{exam_id}/progress", status_code=204)
async def reset_progress(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await progress_service.reset_progress(db, exam_id, user.id)
