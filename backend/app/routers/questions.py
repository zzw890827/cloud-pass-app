from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.question import QuestionPage, QuestionResponse, SubmitAnswerRequest, SubmitAnswerResponse
from app.services import question_service

router = APIRouter(tags=["questions"])


@router.get("/exams/{exam_id}/questions", response_model=QuestionPage)
async def list_questions(
    exam_id: int,
    page: int = 1,
    per_page: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await question_service.get_questions_page(db, exam_id, user.id, page, per_page)


@router.get("/questions/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await question_service.get_question_detail(db, question_id, user.id)


@router.post("/questions/{question_id}/submit", response_model=SubmitAnswerResponse)
async def submit_answer(
    question_id: int,
    data: SubmitAnswerRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await question_service.submit_answer(db, question_id, user.id, data.selected_option_ids)
