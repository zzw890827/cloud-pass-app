import json

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Bookmark, Question, UserProgress
from app.schemas.exam import ProgressSummary
from app.schemas.progress import ProgressDetailItem, ProgressDetailResponse


async def get_progress_summary(db: AsyncSession, exam_id: int, user_id: int) -> ProgressSummary:
    # Total questions in exam
    total_result = await db.execute(
        select(func.count()).select_from(Question).where(Question.exam_id == exam_id)
    )
    total = total_result.scalar() or 0

    # Get question IDs for this exam
    q_ids_result = await db.execute(
        select(Question.id).where(Question.exam_id == exam_id)
    )
    question_ids = [row[0] for row in q_ids_result.all()]

    if not question_ids:
        return ProgressSummary(total=total)

    # Attempted
    progress_result = await db.execute(
        select(UserProgress)
        .where(UserProgress.user_id == user_id, UserProgress.question_id.in_(question_ids))
    )
    progress_items = progress_result.scalars().all()
    correct = sum(1 for p in progress_items if p.is_correct)
    incorrect = len(progress_items) - correct

    # Bookmarked
    bm_result = await db.execute(
        select(func.count())
        .select_from(Bookmark)
        .where(Bookmark.user_id == user_id, Bookmark.question_id.in_(question_ids))
    )
    bookmarked = bm_result.scalar() or 0

    return ProgressSummary(
        total=total,
        attempted=len(progress_items),
        correct=correct,
        incorrect=incorrect,
        bookmarked=bookmarked,
    )


async def get_progress_detail(db: AsyncSession, exam_id: int, user_id: int) -> ProgressDetailResponse:
    summary = await get_progress_summary(db, exam_id, user_id)

    q_ids_result = await db.execute(
        select(Question.id).where(Question.exam_id == exam_id)
    )
    question_ids = [row[0] for row in q_ids_result.all()]

    progress_result = await db.execute(
        select(UserProgress, Question.external_id)
        .join(Question, UserProgress.question_id == Question.id)
        .where(UserProgress.user_id == user_id, UserProgress.question_id.in_(question_ids))
    )

    items = [
        ProgressDetailItem(
            question_id=p.question_id,
            external_id=ext_id,
            is_correct=p.is_correct,
            selected_option_ids=json.loads(p.selected_option_ids),
        )
        for p, ext_id in progress_result.all()
    ]

    return ProgressDetailResponse(summary=summary, items=items)


async def reset_progress(db: AsyncSession, exam_id: int, user_id: int) -> None:
    q_ids_result = await db.execute(
        select(Question.id).where(Question.exam_id == exam_id)
    )
    question_ids = [row[0] for row in q_ids_result.all()]

    if question_ids:
        await db.execute(
            delete(UserProgress).where(
                UserProgress.user_id == user_id, UserProgress.question_id.in_(question_ids)
            )
        )
        await db.commit()
