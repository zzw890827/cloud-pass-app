from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.bookmark import BookmarkResponse, BookmarkWithQuestion
from app.services import bookmark_service

router = APIRouter(tags=["bookmarks"])


@router.post("/questions/{question_id}/bookmark", response_model=BookmarkResponse, status_code=201)
async def add_bookmark(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await bookmark_service.add_bookmark(db, user.id, question_id)


@router.delete("/questions/{question_id}/bookmark", status_code=204)
async def remove_bookmark(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await bookmark_service.remove_bookmark(db, user.id, question_id)


@router.get("/bookmarks", response_model=List[BookmarkWithQuestion])
async def list_bookmarks(
    exam_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await bookmark_service.get_bookmarks(db, user.id, exam_id)
