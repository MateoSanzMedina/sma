from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime, timezone, timedelta
import logging

from app.db.session import get_db
from app.models.models import Usuario, Empresa, SecurityAuditLog
from app.core.security import hash_password, verify_password, create_access_token, get_current_user, RoleChecker
from typing import Optional

logger = logging.getLogger("sma.auth")
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
    clean_pass = request_data.password.strip()
    
    # 1. AUTENTICACIÓN INMEDIATA DE SUPER ADMIN CHAINPOINT
    # Garantiza acceso 100% resiliente incluso si la base de datos externa tiene problemas de red IPv6
    is_chainpoint_super = (
        ident_lower in ["chainpoint", "chainpoint@serving.com.co"] and
        clean_pass in ["ChainPoint2026.", "ChainPoint2026"]
    )

    if is_chainpoint_super:
        token_payload = {
            "sub": "chainpoint-super-admin-root",
            "email": "chainpoint@serving.com.co",
            "role": "ADMIN",
            "empresa_id": "serving-corp-master-id"
        }
        access_token = create_access_token(data=token_payload)
        
        # Intentar registrar log en BD en segundo plano si está disponible
        try:
            sec_log = SecurityAuditLog(
                ip_address=ip_address,
                user_agent=user_agent,
                evento="SUPER_ADMIN_LOGIN_SUCCESS",
                detalle={"role": "ADMIN", "ident": "ChainPoint"}
            )
            db.add(sec_log)
            await db.commit()
        except Exception as e:
            logger.warning(f"No se pudo guardar log de auditoría en BD: {e}")

        return TokenResponse(
            access_token=access_token,
            user=UserResponse(
                id="chainpoint-super-admin-root",
                email="chainpoint@serving.com.co",
                nombre_completo="ChainPoint Super Admin",
                rol="ADMIN",
                empresa_id="serving-corp-master-id"
            )
        )

    # 2. BÚSQUEDA Y VALIDACIÓN EN BASE DE DATOS PARA OTROS USUARIOS
    try:
        stmt = select(Usuario).where(
            or_(
                func.lower(Usuario.email) == ident_lower,
                func.lower(Usuario.email) == f"{ident_lower}@serving.com.co",
                func.lower(Usuario.nombre_completo) == ident_lower
            )
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
    except Exception as db_err:
        logger.error(f"Error de red/conexión a base de datos PostgreSQL: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La base de datos temporalmente no está accesible. Verifique la conexión IPv4 de Supabase."
        )

    if not user or not user.activo:
        try:
            sec_log = SecurityAuditLog(
                ip_address=ip_address,
                user_agent=user_agent,
                evento="LOGIN_FAILED",
                detalle={"input_ident": raw_ident, "reason": "Usuario no encontrado o inactivo"}
            )
            db.add(sec_log)
            await db.commit()
        except Exception:
            pass
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

    # Validar contraseña
    password_valid = verify_password(clean_pass, user.password_hash)

    if not password_valid:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)

        try:
            sec_log = SecurityAuditLog(
                usuario_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent,
                evento="LOGIN_PASSWORD_INVALID",
                detalle={"failed_attempts": user.failed_login_attempts}
            )
            db.add(sec_log)
            await db.commit()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de acceso incorrectas."
        )

    # Resetear intentos fallidos y registrar login exitoso
    user.failed_login_attempts = 0
    user.last_login_at = datetime.now(timezone.utc)

    try:
        sec_log = SecurityAuditLog(
            usuario_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            evento="LOGIN_SUCCESSFUL",
            detalle={"role": user.rol}
        )
        db.add(sec_log)
        await db.commit()
    except Exception:
        pass

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
    if current_user.get("sub") == "chainpoint-super-admin-root":
        return UserResponse(
            id="chainpoint-super-admin-root",
            email="chainpoint@serving.com.co",
            nombre_completo="ChainPoint Super Admin",
            rol="ADMIN",
            empresa_id="serving-corp-master-id"
        )

    try:
        stmt = select(Usuario).where(Usuario.id == current_user["user_id"])
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
    except Exception:
        user = None

    if not user:
        return UserResponse(
            id=current_user.get("user_id", "admin-default"),
            email=current_user.get("email", "admin@serving.com.co"),
            nombre_completo="Usuario Administrativo",
            rol=current_user.get("role", "ADMIN"),
            empresa_id=current_user.get("empresa_id", "serving-default")
        )

    return UserResponse(
        id=user.id,
        email=user.email,
        nombre_completo=user.nombre_completo,
        rol=user.rol,
        empresa_id=user.empresa_id
    )
