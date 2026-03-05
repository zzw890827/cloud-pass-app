from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_db
from app.models import Exam, Provider
from app.schemas.provider import ExamBriefResponse, ProviderDetailResponse, ProviderResponse

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("", response_model=List[ProviderResponse])
async def list_providers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Provider, func.count(Exam.id).label("exam_count"))
        .outerjoin(Exam, Exam.provider_id == Provider.id)
        .group_by(Provider.id)
        .order_by(Provider.name)
    )
    providers = []
    for provider, exam_count in result.all():
        providers.append(
            ProviderResponse(
                id=provider.id,
                name=provider.name,
                slug=provider.slug,
                description=provider.description,
                logo_url=provider.logo_url,
                exam_count=exam_count,
            )
        )
    return providers


@router.get("/{provider_id}", response_model=ProviderDetailResponse)
async def get_provider(provider_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Provider).options(selectinload(Provider.exams)).where(Provider.id == provider_id)
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    return ProviderDetailResponse(
        id=provider.id,
        name=provider.name,
        slug=provider.slug,
        description=provider.description,
        logo_url=provider.logo_url,
        exam_count=len(provider.exams),
        exams=[
            ExamBriefResponse(
                id=e.id, code=e.code, name=e.name,
                total_questions=e.total_questions, is_active=e.is_active,
            )
            for e in provider.exams
        ],
    )
