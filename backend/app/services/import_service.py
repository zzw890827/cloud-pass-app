from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exam, Option, Provider, Question
from app.schemas.import_data import ImportPayload, ImportResult


async def import_questions(db: AsyncSession, data: ImportPayload) -> ImportResult:
    # Upsert provider
    result = await db.execute(select(Provider).where(Provider.slug == data.provider.slug))
    provider = result.scalar_one_or_none()
    if not provider:
        provider = Provider(
            name=data.provider.name,
            slug=data.provider.slug,
            description=data.provider.description,
            logo_url=data.provider.logo_url,
        )
        db.add(provider)
        await db.flush()
    else:
        provider.name = data.provider.name
        provider.description = data.provider.description
        provider.logo_url = data.provider.logo_url

    # Upsert exam
    result = await db.execute(select(Exam).where(Exam.code == data.exam.code))
    exam = result.scalar_one_or_none()
    if not exam:
        exam = Exam(
            provider_id=provider.id,
            code=data.exam.code,
            name=data.exam.name,
            description=data.exam.description,
        )
        db.add(exam)
        await db.flush()
    else:
        exam.name = data.exam.name
        exam.description = data.exam.description

    # Get existing external_ids for this exam
    result = await db.execute(
        select(Question.external_id).where(Question.exam_id == exam.id)
    )
    existing_ids = {row[0] for row in result.all()}

    imported = 0
    skipped = 0

    for idx, q_data in enumerate(data.questions):
        if q_data.external_id in existing_ids:
            skipped += 1
            continue

        num_correct = sum(1 for o in q_data.options if o.is_correct)
        question = Question(
            exam_id=exam.id,
            external_id=q_data.external_id,
            question_text=q_data.question_text,
            question_type=q_data.question_type,
            explanation=q_data.explanation,
            num_correct=num_correct,
            order_index=len(existing_ids) + imported,
        )
        db.add(question)
        await db.flush()

        for o_idx, o_data in enumerate(q_data.options):
            option = Option(
                question_id=question.id,
                label=o_data.label,
                option_text=o_data.text,
                is_correct=o_data.is_correct,
                order_index=o_idx,
            )
            db.add(option)

        imported += 1

    # Update total_questions count
    exam.total_questions = len(existing_ids) + imported

    await db.commit()

    return ImportResult(
        provider_id=provider.id,
        exam_id=exam.id,
        questions_imported=imported,
        questions_skipped=skipped,
    )
