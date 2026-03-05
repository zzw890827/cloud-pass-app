import json
import random
from typing import List, Optional

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Exam, ExamSession, ExamSessionQuestion, Question
from app.schemas.exam_session import (
    ExamErrorReportResponse,
    ExamSessionHistoryItem,
    ExamSessionHistoryResponse,
    ExamSessionQuestionDetail,
    ExamSessionQuestionListItem,
    ExamSessionResponse,
    ExamSessionResultResponse,
    QuestionErrorFrequency,
    SessionOptionResponse,
    SessionQuestionResult,
    SubmitSessionAnswerResponse,
)


async def _get_exam_or_404(db: AsyncSession, exam_id: int) -> Exam:
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    return exam


async def _get_session_or_404(db: AsyncSession, session_id: int, user_id: int) -> ExamSession:
    result = await db.execute(
        select(ExamSession)
        .options(selectinload(ExamSession.questions))
        .where(ExamSession.id == session_id, ExamSession.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


async def _select_weighted_questions(
    db: AsyncSession, exam_id: int, user_id: int, count: int
) -> List[int]:
    """Select questions using weighted random sampling (without replacement).

    Weight formula: weight = 1.0 + 1.0/(pick_count+1) + error_rate*2.0
    - Questions never attempted get the highest weight
    - Questions with high error rates are more likely to be selected
    """
    # Get all question IDs for this exam
    result = await db.execute(
        select(Question.id).where(Question.exam_id == exam_id)
    )
    all_question_ids = [row[0] for row in result.all()]

    if len(all_question_ids) <= count:
        random.shuffle(all_question_ids)
        return all_question_ids

    # Get user's attempt history from exam sessions
    attempt_result = await db.execute(
        select(
            ExamSessionQuestion.question_id,
            func.count().label("pick_count"),
            func.sum(
                func.case(
                    (ExamSessionQuestion.is_correct == False, 1),  # noqa: E712
                    else_=0,
                )
            ).label("error_count"),
            func.sum(
                func.case(
                    (ExamSessionQuestion.is_correct.isnot(None), 1),
                    else_=0,
                )
            ).label("answered_count"),
        )
        .join(ExamSession, ExamSession.id == ExamSessionQuestion.session_id)
        .where(ExamSession.user_id == user_id, ExamSession.exam_id == exam_id)
        .group_by(ExamSessionQuestion.question_id)
    )
    stats = {row[0]: (row[1], row[2] or 0, row[3] or 0) for row in attempt_result.all()}

    # Calculate weights
    weights = []
    for qid in all_question_ids:
        if qid in stats:
            pick_count, error_count, answered_count = stats[qid]
            error_rate = error_count / answered_count if answered_count > 0 else 0.0
            weight = 1.0 + 1.0 / (pick_count + 1) + error_rate * 2.0
        else:
            # Never attempted — highest weight
            weight = 1.0 + 1.0 + 2.0  # = 4.0
        weights.append(weight)

    # Weighted sampling without replacement
    selected = []
    remaining_ids = list(all_question_ids)
    remaining_weights = list(weights)

    for _ in range(count):
        total = sum(remaining_weights)
        r = random.uniform(0, total)
        cumulative = 0.0
        for i, w in enumerate(remaining_weights):
            cumulative += w
            if cumulative >= r:
                selected.append(remaining_ids[i])
                remaining_ids.pop(i)
                remaining_weights.pop(i)
                break

    return selected


async def create_session(db: AsyncSession, exam_id: int, user_id: int) -> ExamSessionResponse:
    exam = await _get_exam_or_404(db, exam_id)

    # Check for existing in_progress session
    existing = await db.execute(
        select(ExamSession).where(
            ExamSession.user_id == user_id,
            ExamSession.exam_id == exam_id,
            ExamSession.status == "in_progress",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An exam session is already in progress for this exam",
        )

    # Select questions
    question_ids = await _select_weighted_questions(db, exam_id, user_id, exam.num_questions)

    # Create session with config snapshot
    session = ExamSession(
        user_id=user_id,
        exam_id=exam_id,
        status="in_progress",
        num_questions=exam.num_questions,
        pass_percentage=exam.pass_percentage,
        time_limit_minutes=exam.time_limit_minutes,
    )
    db.add(session)
    await db.flush()  # Get session.id

    # Create session questions
    for idx, qid in enumerate(question_ids):
        sq = ExamSessionQuestion(
            session_id=session.id,
            question_id=qid,
            order_index=idx,
        )
        db.add(sq)

    await db.commit()
    await db.refresh(session)

    # Reload with questions
    result = await db.execute(
        select(ExamSession)
        .options(selectinload(ExamSession.questions))
        .where(ExamSession.id == session.id)
    )
    session = result.scalar_one()

    return _build_session_response(session, exam)


async def get_session(db: AsyncSession, session_id: int, user_id: int) -> ExamSessionResponse:
    session = await _get_session_or_404(db, session_id, user_id)

    exam_result = await db.execute(select(Exam).where(Exam.id == session.exam_id))
    exam = exam_result.scalar_one()

    return _build_session_response(session, exam)


async def get_active_session(
    db: AsyncSession, exam_id: int, user_id: int
) -> Optional[ExamSessionResponse]:
    result = await db.execute(
        select(ExamSession)
        .options(selectinload(ExamSession.questions))
        .where(
            ExamSession.user_id == user_id,
            ExamSession.exam_id == exam_id,
            ExamSession.status == "in_progress",
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        return None

    exam_result = await db.execute(select(Exam).where(Exam.id == session.exam_id))
    exam = exam_result.scalar_one()

    return _build_session_response(session, exam)


async def get_session_question(
    db: AsyncSession, session_id: int, user_id: int, order_index: int
) -> ExamSessionQuestionDetail:
    session = await _get_session_or_404(db, session_id, user_id)

    # Find the session question by order_index
    sq = None
    for q in session.questions:
        if q.order_index == order_index:
            sq = q
            break

    if sq is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found at this index")

    # Load the actual question with options
    q_result = await db.execute(
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.id == sq.question_id)
    )
    question = q_result.scalar_one()

    options = [
        SessionOptionResponse(id=o.id, label=o.label, option_text=o.option_text)
        for o in question.options
    ]

    selected_ids = json.loads(sq.selected_option_ids) if sq.selected_option_ids else None

    return ExamSessionQuestionDetail(
        session_question_id=sq.id,
        question_id=question.id,
        order_index=sq.order_index,
        external_id=question.external_id,
        question_text=question.question_text,
        question_type=question.question_type,
        num_correct=question.num_correct,
        options=options,
        selected_option_ids=selected_ids,
        is_correct=sq.is_correct if session.status == "completed" else None,
    )


async def submit_session_answer(
    db: AsyncSession, session_id: int, user_id: int, order_index: int, selected_option_ids: List[int]
) -> SubmitSessionAnswerResponse:
    session = await _get_session_or_404(db, session_id, user_id)

    if session.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not in progress")

    # Find session question
    sq = None
    for q in session.questions:
        if q.order_index == order_index:
            sq = q
            break

    if sq is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found at this index")

    # Load question to check correct answers
    q_result = await db.execute(
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.id == sq.question_id)
    )
    question = q_result.scalar_one()

    correct_ids = {o.id for o in question.options if o.is_correct}
    is_correct = set(selected_option_ids) == correct_ids

    sq.selected_option_ids = json.dumps(selected_option_ids)
    sq.is_correct = is_correct

    await db.commit()

    return SubmitSessionAnswerResponse(is_answered=True)


async def complete_session(db: AsyncSession, session_id: int, user_id: int) -> ExamSessionResultResponse:
    session = await _get_session_or_404(db, session_id, user_id)

    if session.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not in progress")

    # Calculate results
    total_answered = 0
    correct_count = 0
    for sq in session.questions:
        if sq.is_correct is not None:
            total_answered += 1
            if sq.is_correct:
                correct_count += 1

    score = (correct_count / session.num_questions * 100) if session.num_questions > 0 else 0.0
    passed = score >= session.pass_percentage

    session.status = "completed"
    session.score = round(score, 1)
    session.correct_count = correct_count
    session.total_answered = total_answered
    session.passed = passed
    session.completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(session)

    return await get_session_result(db, session_id, user_id)


async def get_session_result(db: AsyncSession, session_id: int, user_id: int) -> ExamSessionResultResponse:
    session = await _get_session_or_404(db, session_id, user_id)

    if session.status != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not completed")

    exam_result = await db.execute(select(Exam).where(Exam.id == session.exam_id))
    exam = exam_result.scalar_one()

    # Build question results with external_id
    question_ids = [sq.question_id for sq in session.questions]
    q_result = await db.execute(
        select(Question.id, Question.external_id).where(Question.id.in_(question_ids))
    )
    external_id_map = {row[0]: row[1] for row in q_result.all()}

    question_results = []
    for sq in session.questions:
        selected_ids = json.loads(sq.selected_option_ids) if sq.selected_option_ids else None
        question_results.append(
            SessionQuestionResult(
                question_id=sq.question_id,
                external_id=external_id_map.get(sq.question_id, ""),
                is_correct=sq.is_correct,
                selected_option_ids=selected_ids,
            )
        )

    return ExamSessionResultResponse(
        id=session.id,
        exam_id=session.exam_id,
        exam_code=exam.code,
        exam_name=exam.name,
        status=session.status,
        num_questions=session.num_questions,
        pass_percentage=session.pass_percentage,
        time_limit_minutes=session.time_limit_minutes,
        started_at=session.started_at,
        completed_at=session.completed_at,
        score=session.score,
        correct_count=session.correct_count,
        total_answered=session.total_answered,
        passed=session.passed,
        question_results=question_results,
    )


async def abandon_session(db: AsyncSession, session_id: int, user_id: int) -> None:
    session = await _get_session_or_404(db, session_id, user_id)

    if session.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is not in progress")

    session.status = "abandoned"
    session.completed_at = datetime.utcnow()
    await db.commit()


async def get_session_history(
    db: AsyncSession, exam_id: int, user_id: int
) -> ExamSessionHistoryResponse:
    exam = await _get_exam_or_404(db, exam_id)

    result = await db.execute(
        select(ExamSession)
        .where(
            ExamSession.user_id == user_id,
            ExamSession.exam_id == exam_id,
            ExamSession.status == "completed",
        )
        .order_by(ExamSession.started_at)
    )
    sessions = result.scalars().all()

    items = [
        ExamSessionHistoryItem(
            id=s.id,
            status=s.status,
            score=s.score,
            correct_count=s.correct_count,
            total_answered=s.total_answered,
            passed=s.passed,
            num_questions=s.num_questions,
            pass_percentage=s.pass_percentage,
            started_at=s.started_at,
            completed_at=s.completed_at,
        )
        for s in sessions
    ]

    return ExamSessionHistoryResponse(
        exam_id=exam.id,
        exam_code=exam.code,
        exam_name=exam.name,
        items=items,
    )


async def get_error_report(
    db: AsyncSession, exam_id: int, user_id: int
) -> ExamErrorReportResponse:
    # Aggregate error frequency across all completed sessions for this exam
    result = await db.execute(
        select(
            ExamSessionQuestion.question_id,
            Question.external_id,
            func.sum(
                func.case(
                    (ExamSessionQuestion.is_correct == False, 1),  # noqa: E712
                    else_=0,
                )
            ).label("error_count"),
            func.count().label("attempt_count"),
        )
        .join(ExamSession, ExamSession.id == ExamSessionQuestion.session_id)
        .join(Question, Question.id == ExamSessionQuestion.question_id)
        .where(
            ExamSession.user_id == user_id,
            ExamSession.exam_id == exam_id,
            ExamSession.status == "completed",
            ExamSessionQuestion.is_correct.isnot(None),
        )
        .group_by(ExamSessionQuestion.question_id, Question.external_id)
    )
    rows = result.all()

    items = []
    for row in rows:
        error_count = row[2] or 0
        attempt_count = row[3] or 1
        if error_count > 0:
            items.append(
                QuestionErrorFrequency(
                    question_id=row[0],
                    external_id=row[1],
                    error_count=error_count,
                    attempt_count=attempt_count,
                    error_rate=round(error_count / attempt_count, 2),
                )
            )

    items.sort(key=lambda x: x.error_count, reverse=True)

    return ExamErrorReportResponse(exam_id=exam_id, items=items)


def _build_session_response(session: ExamSession, exam: Exam) -> ExamSessionResponse:
    questions = [
        ExamSessionQuestionListItem(
            id=sq.id,
            question_id=sq.question_id,
            order_index=sq.order_index,
            is_answered=sq.selected_option_ids is not None,
            is_correct=sq.is_correct if session.status == "completed" else None,
        )
        for sq in session.questions
    ]

    return ExamSessionResponse(
        id=session.id,
        exam_id=session.exam_id,
        exam_code=exam.code,
        exam_name=exam.name,
        status=session.status,
        num_questions=session.num_questions,
        pass_percentage=session.pass_percentage,
        time_limit_minutes=session.time_limit_minutes,
        started_at=session.started_at,
        completed_at=session.completed_at,
        score=session.score if session.status == "completed" else None,
        questions=questions,
    )
