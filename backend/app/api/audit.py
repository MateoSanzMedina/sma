from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from app.db.session import get_db
from app.models.models import AgenteAuditLog
from app.core.security import get_current_user, RoleChecker

router = APIRouter()

class AuditLogResponse(BaseModel):
    id: str
    agente_name: str
    accion: str
    confidence_score: float
    input_summary: Optional[str]
    output_json: Dict[str, Any]
    reasoning: Optional[str]
    status: str
    reviewed_by_id: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime

class ReviewActionRequest(BaseModel):
    action: str  # "APPROVE" o "REJECT"
    comments: Optional[str] = None

@router.get("/logs", response_model=List[AuditLogResponse])
async def list_agent_logs(
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Obtiene la lista de registros de auditoría de agentes IA para supervisión humana (HITL)."""
    stmt = select(AgenteAuditLog)
    if status_filter:
        stmt = stmt.where(AgenteAuditLog.status == status_filter)
    stmt = stmt.order_by(AgenteAuditLog.created_at.desc()).limit(100)
    
    result = await db.execute(stmt)
    logs = result.scalars().all()
    
    return [
        AuditLogResponse(
            id=log.id,
            agente_name=log.agente_name,
            accion=log.accion,
            confidence_score=float(log.confidence_score),
            input_summary=log.input_summary,
            output_json=log.output_json,
            reasoning=log.reasoning,
            status=log.status,
            reviewed_by_id=log.reviewed_by_id,
            reviewed_at=log.reviewed_at,
            created_at=log.created_at
        )
        for log in logs
    ]

@router.post("/review/{log_id}")
async def review_agent_decision(
    log_id: str,
    review_req: ReviewActionRequest,
    current_user: dict = Depends(RoleChecker(["ADMIN", "DIRECTOR_OBRA", "GESTION_HUMANA"])),
    db: AsyncSession = Depends(get_db)
):
    """Permite al ingeniero/supervisor humano aprobar o rechazar una recomendación del agente de IA."""
    stmt = select(AgenteAuditLog).where(AgenteAuditLog.id == log_id)
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="Registro de auditoría no encontrado.")
        
    new_status = "APPROVED" if review_req.action == "APPROVE" else "REJECTED"
    
    log.status = new_status
    log.reviewed_by_id = current_user["user_id"]
    log.reviewed_at = datetime.now(timezone.utc)
    if review_req.comments:
        log.reasoning = (log.reasoning or "") + f" | Comentario de revisión: {review_req.comments}"
        
    await db.commit()
    
    return {
        "success": True,
        "message": f"Decisión de agente actualizada a {new_status} correctamente por {current_user['email']}."
    }
