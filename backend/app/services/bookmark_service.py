from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Bookmark, Question
from app.schemas.bookmark import BookmarkWithQuestion


async def add_bookmark(db: AsyncSession, user_id: int, question_id: int) -> Bookmark:
    # Check question exists
    q_result = await db.execute(select(Question).where(Question.id == question_id))
    if not q_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    # Check if already bookmarked
    result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == user_id, Bookmark.question_id == question_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    bookmark = Bookmark(user_id=user_id, question_id=question_id)
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)
    return bookmark


async def remove_bookmark(db: AsyncSession, user_id: int, question_id: int) -> None:
    result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == user_id, Bookmark.question_id == question_id)
    )
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")

    await db.delete(bookmark)
    await db.commit()


async def get_bookmarks(
    db: AsyncSession, user_id: int, exam_id: Optional[int] = None
) -> List[BookmarkWithQuestion]:
    query = (
        select(Bookmark, Question)
        .join(Question, Bookmark.question_id == Question.id)
        .where(Bookmark.user_id == user_id)
    )
    if exam_id:
        query = query.where(Question.exam_id == exam_id)
    query = query.order_by(Bookmark.created_at.desc())

    result = await db.execute(query)
    items = []
    for bm, q in result.all():
        items.append(
            BookmarkWithQuestion(
                id=bm.id,
                question_id=bm.question_id,
                created_at=bm.created_at,
                question_text=q.question_text,
                question_type=q.question_type,
                exam_id=q.exam_id,
            )
        )
    return items
