from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime, timezone, timedelta
from app.db.session import get_db
from app.models.models import Usuario, Empresa, SecurityAuditLog
from app.core.security import hash_password, verify_password, create_access_token, get_current_user, RoleChecker
from typing import Optional

router = APIRouter()

class LoginRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    nombre_completo: str
    rol: str
    empresa_id: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

@router.post("/login", response_model=TokenResponse)
async def login(request_data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Endpoint de Login seguro con soporte para usuario 'ChainPoint' o correo corporativo."""
    ip_address = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Desconocido")
    
    # Obtener el identificador ingresado (acepta username o email)
    raw_ident = (request_data.username or request_data.email or "").strip()
    if not raw_ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe ingresar su usuario o correo electrónico."
        )

    ident_lower = raw_ident.lower()
    
    # 1. Soporte especial Super Admin: ChainPoint / ChainPoint2026.
    is_chainpoint_super = (
        ident_lower in ["chainpoint", "chainpoint@serving.com.co"] and
        request_data.password.strip() in ["ChainPoint2026.", "ChainPoint2026"]
    )

    # Buscar usuario en la base de datos por email o alias
    stmt = select(Usuario).where(
        or_(
            func.lower(Usuario.email) == ident_lower,
            func.lower(Usuario.email) == f"{ident_lower}@serving.com.co",
            func.lower(Usuario.nombre_completo) == ident_lower
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # Si es el Super Admin ChainPoint y aún no existe en la BD de Supabase, crearlo automáticamente
    if not user and is_chainpoint_super:
        res_emp = await db.execute(select(Empresa).limit(1))
        emp = res_emp.scalar_one_or_none()
        if not emp:
            emp = Empresa(
                nit="900123456-1",
                razon_social="Constructora Serving S.A.S.",
                direccion="Sede Principal, Colombia"
            )
            db.add(emp)
            await db.commit()
            await db.refresh(emp)

        user = Usuario(
            email="chainpoint@serving.com.co",
            nombre_completo="ChainPoint Super Admin",
            password_hash=hash_password("ChainPoint2026."),
            rol="ADMIN",
            empresa_id=emp.id,
            activo=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user or not user.activo:
        sec_log = SecurityAuditLog(
            ip_address=ip_address,
            user_agent=user_agent,
            evento="LOGIN_FAILED",
            detalle={"input_ident": raw_ident, "reason": "Usuario no encontrado o inactivo"}
        )
        db.add(sec_log)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de acceso incorrectas."
        )

    # Verificar bloqueo por intentos fallidos
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Cuenta temporalmente bloqueada por múltiples intentos fallidos. Intente en 15 minutos."
        )

    # Validar contraseña (con soporte directo para ChainPoint Super Admin)
    password_valid = verify_password(request_data.password, user.password_hash) or is_chainpoint_super

    if not password_valid:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)

        sec_log = SecurityAuditLog(
            usuario_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            evento="LOGIN_PASSWORD_INVALID",
            detalle={"failed_attempts": user.failed_login_attempts}
        )
        db.add(sec_log)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de acceso incorrectas."
        )

    # Resetear intentos fallidos y registrar login exitoso
    user.failed_login_attempts = 0
    user.last_login_at = datetime.now(timezone.utc)

    sec_log = SecurityAuditLog(
        usuario_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        evento="LOGIN_SUCCESSFUL",
        detalle={"role": user.rol}
    )
    db.add(sec_log)
    await db.commit()

    token_payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.rol,
        "empresa_id": user.empresa_id
    }
    access_token = create_access_token(data=token_payload)

    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            nombre_completo=user.nombre_completo,
            rol=user.rol,
            empresa_id=user.empresa_id
        )
    )

@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Obtiene el perfil del usuario autenticado."""
    stmt = select(Usuario).where(Usuario.id == current_user["user_id"])
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    return UserResponse(
        id=user.id,
        email=user.email,
        nombre_completo=user.nombre_completo,
        rol=user.rol,
        empresa_id=user.empresa_id
    )
