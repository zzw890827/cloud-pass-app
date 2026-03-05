import json
import math
from typing import List

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Bookmark, Option, Question, UserProgress
from app.schemas.question import (
    OptionResponse,
    OptionWithAnswerResponse,
    QuestionListItem,
    QuestionPage,
    QuestionResponse,
    SubmitAnswerResponse,
    UserProgressBrief,
)


async def get_questions_page(
    db: AsyncSession, exam_id: int, user_id: int, page: int = 1, per_page: int = 50
) -> QuestionPage:
    per_page = min(per_page, 200)  # Cap to prevent abuse
    count_result = await db.execute(
        select(func.count()).select_from(Question).where(Question.exam_id == exam_id)
    )
    total = count_result.scalar() or 0
    total_pages = math.ceil(total / per_page) if total > 0 else 1

    offset = (page - 1) * per_page
    result = await db.execute(
        select(Question)
        .where(Question.exam_id == exam_id)
        .order_by(Question.order_index)
        .offset(offset)
        .limit(per_page)
    )
    questions = result.scalars().all()
    question_ids = [q.id for q in questions]

    progress_result = await db.execute(
        select(UserProgress)
        .where(UserProgress.user_id == user_id, UserProgress.question_id.in_(question_ids))
    )
    progress_map = {p.question_id: p for p in progress_result.scalars().all()}

    bookmark_result = await db.execute(
        select(Bookmark.question_id)
        .where(Bookmark.user_id == user_id, Bookmark.question_id.in_(question_ids))
    )
    bookmarked_ids = {row[0] for row in bookmark_result.all()}

    items = []
    for q in questions:
        p = progress_map.get(q.id)
        items.append(
            QuestionListItem(
                id=q.id,
                external_id=q.external_id,
                question_type=q.question_type,
                num_correct=q.num_correct,
                order_index=q.order_index,
                is_attempted=p is not None,
                is_correct=p.is_correct if p else None,
                is_bookmarked=q.id in bookmarked_ids,
            )
        )

    return QuestionPage(items=items, total=total, page=page, per_page=per_page, total_pages=total_pages)


async def get_question_detail(db: AsyncSession, question_id: int, user_id: int) -> QuestionResponse:
    result = await db.execute(
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.id == question_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    bm_result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == user_id, Bookmark.question_id == question_id)
    )
    is_bookmarked = bm_result.scalar_one_or_none() is not None

    prog_result = await db.execute(
        select(UserProgress).where(UserProgress.user_id == user_id, UserProgress.question_id == question_id)
    )
    progress = prog_result.scalar_one_or_none()
    user_progress = None
    if progress:
        user_progress = UserProgressBrief(
            is_correct=progress.is_correct,
            selected_option_ids=json.loads(progress.selected_option_ids),
        )

    options = [
        OptionResponse(id=o.id, label=o.label, option_text=o.option_text)
        for o in question.options
    ]

    return QuestionResponse(
        id=question.id,
        external_id=question.external_id,
        question_text=question.question_text,
        question_type=question.question_type,
        num_correct=question.num_correct,
        order_index=question.order_index,
        options=options,
        is_bookmarked=is_bookmarked,
        user_progress=user_progress,
    )


async def submit_answer(
    db: AsyncSession, question_id: int, user_id: int, selected_option_ids: List[int]
) -> SubmitAnswerResponse:
    result = await db.execute(
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.id == question_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    correct_ids = {o.id for o in question.options if o.is_correct}
    is_correct = set(selected_option_ids) == correct_ids

    prog_result = await db.execute(
        select(UserProgress).where(
            UserProgress.user_id == user_id, UserProgress.question_id == question_id
        )
    )
    progress = prog_result.scalar_one_or_none()
    if progress:
        progress.is_correct = is_correct
        progress.selected_option_ids = json.dumps(selected_option_ids)
    else:
        progress = UserProgress(
            user_id=user_id,
            question_id=question_id,
            is_correct=is_correct,
            selected_option_ids=json.dumps(selected_option_ids),
        )
        db.add(progress)

    await db.commit()

    options_with_answers = [
        OptionWithAnswerResponse(
            id=o.id, label=o.label, option_text=o.option_text, is_correct=o.is_correct
        )
        for o in question.options
    ]

    return SubmitAnswerResponse(
        is_correct=is_correct,
        correct_option_ids=list(correct_ids),
        explanation=question.explanation,
        options=options_with_answers,
    )
