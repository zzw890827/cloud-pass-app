from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas.exam_session import (
    CreateExamSessionRequest,
    ExamErrorReportResponse,
    ExamSessionHistoryResponse,
    ExamSessionQuestionDetail,
    ExamSessionResponse,
    ExamSessionResultResponse,
    SubmitSessionAnswerRequest,
    SubmitSessionAnswerResponse,
)
from app.services import exam_session_service

router = APIRouter(prefix="/exam-sessions", tags=["exam-sessions"])


@router.post("", response_model=ExamSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: CreateExamSessionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await exam_session_service.create_session(db, data.exam_id, user.id)


@router.get("/active", response_model=Optional[ExamSessionResponse])
async def get_active_session(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await exam_session_service.get_active_session(db, exam_id, user.id)


@router.get("/history", response_model=ExamSessionHistoryResponse)
async def get_session_history(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await exam_session_service.get_session_history(db, exam_id, user.id)


@router.get("/error-report", response_model=ExamErrorReportResponse)
async def get_error_report(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await exam_session_service.get_error_report(db, exam_id, user.id)


@router.get("/{session_id}", response_model=ExamSessionResponse)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await exam_session_service.get_session(db, session_id, user.id)


@router.get("/{session_id}/result", response_model=ExamSessionResultResponse)
async def get_session_result(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await exam_session_service.get_session_result(db, session_id, user.id)


@router.get("/{session_id}/questions/{order_index}", response_model=ExamSessionQuestionDetail)
async def get_session_question(
    session_id: int,
    order_index: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await exam_session_service.get_session_question(db, session_id, user.id, order_index)


@router.post(
    "/{session_id}/questions/{order_index}/submit",
    response_model=SubmitSessionAnswerResponse,
)
async def submit_session_answer(
    session_id: int,
    order_index: int,
    data: SubmitSessionAnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await exam_session_service.submit_session_answer(
        db, session_id, user.id, order_index, data.selected_option_ids
    )


@router.post("/{session_id}/complete", response_model=ExamSessionResultResponse)
async def complete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await exam_session_service.complete_session(db, session_id, user.id)


@router.post("/{session_id}/abandon", status_code=status.HTTP_204_NO_CONTENT)
async def abandon_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await exam_session_service.abandon_session(db, session_id, user.id)
