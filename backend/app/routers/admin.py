from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_admin_user, get_db
from app.schemas.import_data import ImportPayload, ImportResult
from app.services import import_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/import", response_model=ImportResult)
async def import_data(
    data: ImportPayload,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_admin_user),
):
    return await import_service.import_questions(db, data)
