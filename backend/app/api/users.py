from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.models import Usuario, Empresa, SecurityAuditLog
from app.core.security import (
    hash_password,
    get_current_user,
    RoleChecker,
    validate_password_complexity
)

router = APIRouter()

class UserItemResponse(BaseModel):
    id: str
    email: str
    nombre_completo: str
    rol: str
    activo: bool
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

class CreateUserRequest(BaseModel):
    email: str
    nombre_completo: str
    password: str = Field(..., min_length=8)
    rol: str = "RESIDENTE"

class ResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)

class UpdateUserRequest(BaseModel):
    nombre_completo: Optional[str] = None
    rol: Optional[str] = None

VALID_ROLES = {"ADMIN", "DIRECTOR_OBRA", "RESIDENTE", "GESTION_HUMANA", "CONTABILIDAD", "CLIENTE"}

@router.get("", response_model=List[UserItemResponse])
async def list_users(
    current_user: dict = Depends(RoleChecker(["ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Lista todos los usuarios registrados en la empresa del Administrador (OWASP A01 RBAC)."""
    stmt = select(Usuario).order_by(Usuario.created_at.desc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    return [
        UserItemResponse(
            id=str(u.id),
            email=u.email,
            nombre_completo=u.nombre_completo,
            rol=str(u.rol),
            activo=u.activo,
            last_login_at=u.last_login_at,
            created_at=u.created_at
        )
        for u in users
    ]

@router.post("", response_model=UserItemResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    req: CreateUserRequest,
    current_user: dict = Depends(RoleChecker(["ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Crea un nuevo usuario en la plataforma con contraseña hasheada y rol corporativo."""
    clean_email = req.email.strip().lower()
    if "@" not in clean_email:
        clean_email = f"{clean_email}@serving.com.co"

    if req.rol not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Rol no válido. Roles permitidos: {', '.join(VALID_ROLES)}"
        )

    # Verificar si el usuario ya existe
    stmt_check = select(Usuario).where(func.lower(Usuario.email) == clean_email)
    res_check = await db.execute(stmt_check)
    if res_check.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un usuario registrado con el correo/usuario '{clean_email}'."
        )

    validate_password_complexity(req.password)
    hashed = hash_password(req.password)
    empresa_id = current_user.get("empresa_id")

    # Si por alguna razón la empresa no está en el token, buscar la primera empresa disponible
    if not empresa_id:
        res_emp = await db.execute(select(Empresa).limit(1))
        emp = res_emp.scalar_one_or_none()
        empresa_id = emp.id if emp else "serving-default-id"

    new_user = Usuario(
        email=clean_email,
        password_hash=hashed,
        nombre_completo=req.nombre_completo.strip(),
        rol=req.rol,
        empresa_id=empresa_id,
        activo=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserItemResponse(
        id=str(new_user.id),
        email=new_user.email,
        nombre_completo=new_user.nombre_completo,
        rol=str(new_user.rol),
        activo=new_user.activo,
        last_login_at=new_user.last_login_at,
        created_at=new_user.created_at
    )

@router.patch("/{user_id}/toggle", response_model=UserItemResponse)
async def toggle_user_status(
    user_id: str,
    current_user: dict = Depends(RoleChecker(["ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Activa o suspende el acceso de un usuario en la plataforma."""
    if current_user["user_id"] == user_id:
        raise HTTPException(
            status_code=400,
            detail="No puedes suspender tu propia cuenta de administrador."
        )

    stmt = select(Usuario).where(Usuario.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    user.activo = not user.activo
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    return UserItemResponse(
        id=str(user.id),
        email=user.email,
        nombre_completo=user.nombre_completo,
        rol=str(user.rol),
        activo=user.activo,
        last_login_at=user.last_login_at,
        created_at=user.created_at
    )

@router.put("/{user_id}/password")
async def reset_user_password(
    user_id: str,
    req: ResetPasswordRequest,
    current_user: dict = Depends(RoleChecker(["ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Permite al administrador resetear la contraseña de cualquier usuario."""
    stmt = select(Usuario).where(Usuario.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    validate_password_complexity(req.new_password)
    user.password_hash = hash_password(req.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"success": True, "message": f"Contraseña del usuario {user.email} actualizada con éxito."}

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(RoleChecker(["ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Elimina un usuario de la base de datos."""
    if current_user["user_id"] == user_id:
        raise HTTPException(
            status_code=400,
            detail="No puedes eliminar tu propia cuenta de administrador."
        )

    stmt = select(Usuario).where(Usuario.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    await db.delete(user)
    await db.commit()

    return {"success": True, "message": "Usuario eliminado correctamente."}
