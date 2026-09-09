from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional, Dict, Any

from app.db.session import get_db
from app.models.models import Usuario, Empresa, SecurityAuditLog
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    RoleChecker,
    generate_totp_secret,
    get_totp_uri,
    verify_totp_code,
    create_temp_2fa_token,
    decode_temp_2fa_token
)
from app.core.limiter import limiter
from app.core.config import settings

logger = logging.getLogger("sma.auth")
router = APIRouter()

# --- Modelos de Entrada y Salida ---
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
    totp_enabled: bool = False

class LoginResponse(BaseModel):
    requires_2fa: bool = False
    temp_token: Optional[str] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    user: Optional[UserResponse] = None
    message: Optional[str] = None

class Verify2FARequest(BaseModel):
    temp_token: str
    code: str

class Setup2FAResponse(BaseModel):
    secret: str
    otpauth_url: str

class Enable2FARequest(BaseModel):
    code: str

class Disable2FARequest(BaseModel):
    password: str
    code: str


@router.post("/login", response_model=LoginResponse)
@limiter.limit(f"{settings.AUTH_RATE_LIMIT_PER_MINUTE}/minute")
async def login(request_data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """
    Autenticación segura de usuarios (OWASP A07).
    Consulta exclusivamente la base de datos PostgreSQL con verificación de hash Bcrypt/Argon2.
    Soporta desafío de segundo factor (TOTP / 2FA) si está activado.
    """
    ip_address = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Desconocido")
    
    raw_ident = (request_data.username or request_data.email or "").strip()
    if not raw_ident:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe ingresar su usuario o correo electrónico."
        )

    ident_lower = raw_ident.lower()
    clean_pass = request_data.password.strip()

    # Búsqueda estricta en base de datos
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
        logger.error(f"Error de conexión a la base de datos: {db_err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servicio de autenticación no está disponible en este momento. Intente más tarde."
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

    # Verificar bloqueo temporal por múltiples intentos fallidos (Anti Brute-Force)
    if user.locked_until:
        locked_dt = user.locked_until
        if locked_dt.tzinfo is None:
            locked_dt = locked_dt.replace(tzinfo=timezone.utc)
        if locked_dt > datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Cuenta temporalmente bloqueada por múltiples intentos fallidos. Intente en 15 minutos."
            )

    # Validar contraseña hasheada
    password_valid = verify_password(clean_pass, user.password_hash)

    if not password_valid:
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)

        try:
            sec_log = SecurityAuditLog(
                usuario_id=str(user.id) if user.id else None,
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

    # Contraseña correcta: resetear contador de intentos fallidos
    user.failed_login_attempts = 0
    user.last_login_at = datetime.now(timezone.utc)

    # Si el usuario tiene 2FA activado, emitir desafío TOTP pre-auth
    if user.totp_enabled and user.totp_secret:
        temp_token = create_temp_2fa_token(str(user.id), user.email)
        try:
            sec_log = SecurityAuditLog(
                usuario_id=str(user.id) if user.id else None,
                ip_address=ip_address,
                user_agent=user_agent,
                evento="LOGIN_2FA_CHALLENGE_ISSUED",
                detalle={"email": user.email}
            )
            db.add(sec_log)
            await db.commit()
        except Exception:
            pass
            
        return LoginResponse(
            requires_2fa=True,
            temp_token=temp_token,
            message="Ingrese el código de 6 dígitos de su aplicación de autenticación."
        )

    # Si no tiene 2FA, emitir token JWT final
    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": str(user.rol),
        "empresa_id": str(user.empresa_id)
    }
    access_token = create_access_token(data=token_payload)

    try:
        sec_log = SecurityAuditLog(
            usuario_id=str(user.id) if user.id else None,
            ip_address=ip_address,
            user_agent=user_agent,
            evento="LOGIN_SUCCESSFUL",
            detalle={"role": str(user.rol)}
        )
        db.add(sec_log)
        await db.commit()
    except Exception:
        pass

    return LoginResponse(
        requires_2fa=False,
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            nombre_completo=user.nombre_completo,
            rol=str(user.rol),
            empresa_id=str(user.empresa_id),
            totp_enabled=bool(user.totp_enabled)
        )
    )


@router.post("/2fa/verify", response_model=LoginResponse)
@limiter.limit(f"{settings.AUTH_RATE_LIMIT_PER_MINUTE}/minute")
async def verify_2fa(request_data: Verify2FARequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Valida el código TOTP de 6 dígitos emitido por Google Authenticator tras el login primario."""
    ip_address = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Desconocido")

    # 1. Validar token temporal
    token_data = decode_temp_2fa_token(request_data.temp_token)
    user_id = token_data.get("sub")

    # 2. Obtener usuario de la base de datos
    stmt = select(Usuario).where(Usuario.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.activo or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión o configuración de dos factores no válida."
        )

    # 3. Validar código TOTP
    is_valid = verify_totp_code(user.totp_secret, request_data.code)
    if not is_valid:
        try:
            sec_log = SecurityAuditLog(
                usuario_id=str(user.id) if user.id else None,
                ip_address=ip_address,
                user_agent=user_agent,
                evento="2FA_VERIFY_FAILED",
                detalle={"reason": "Código TOTP inválido"}
            )
            db.add(sec_log)
            await db.commit()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código de autenticación inválido o expirado. Verifique la hora de su dispositivo."
        )

    # 4. Código válido: emitir token definitivo
    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": str(user.rol),
        "empresa_id": str(user.empresa_id)
    }
    access_token = create_access_token(data=token_payload)

    try:
        sec_log = SecurityAuditLog(
            usuario_id=str(user.id) if user.id else None,
            ip_address=ip_address,
            user_agent=user_agent,
            evento="LOGIN_2FA_SUCCESSFUL",
            detalle={"role": str(user.rol)}
        )
        db.add(sec_log)
        await db.commit()
    except Exception:
        pass

    return LoginResponse(
        requires_2fa=False,
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            nombre_completo=user.nombre_completo,
            rol=str(user.rol),
            empresa_id=str(user.empresa_id),
            totp_enabled=True
        )
    )


@router.post("/2fa/setup", response_model=Setup2FAResponse)
@limiter.limit("10/minute")
async def setup_2fa(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Genera la clave secreta y la URL otpauth:// para vincular con Google Authenticator."""
    user_id = current_user.get("user_id")
    stmt = select(Usuario).where(Usuario.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    # Generar nueva clave secreta TOTP
    secret = generate_totp_secret()
    user.totp_secret = secret
    # Mantener totp_enabled=False hasta que el usuario demuestre que vinculó la app con éxito
    await db.commit()

    otpauth_url = get_totp_uri(secret, user.email)
    return Setup2FAResponse(secret=secret, otpauth_url=otpauth_url)


@router.post("/2fa/enable")
@limiter.limit("10/minute")
async def enable_2fa(
    request_data: Enable2FARequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Confirma la vinculación de 2FA validando el primer código de 6 dígitos."""
    user_id = current_user.get("user_id")
    stmt = select(Usuario).where(Usuario.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primero debe solicitar la clave de configuración 2FA."
        )

    is_valid = verify_totp_code(user.totp_secret, request_data.code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de verificación no coincide. Verifique e intente nuevamente."
        )

    user.totp_enabled = True
    await db.commit()

    return {"success": True, "message": "Autenticación de dos factores (2FA) activada exitosamente."}


@router.post("/2fa/disable")
@limiter.limit("5/minute")
async def disable_2fa(
    request_data: Disable2FARequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Desactiva 2FA requiriendo la contraseña actual y un código TOTP vigente."""
    user_id = current_user.get("user_id")
    stmt = select(Usuario).where(Usuario.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    if not verify_password(request_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Contraseña incorrecta.")

    if not verify_totp_code(user.totp_secret or "", request_data.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código 2FA incorrecto.")

    user.totp_enabled = False
    user.totp_secret = None
    await db.commit()

    return {"success": True, "message": "Autenticación de dos factores desactivada."}


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Obtiene el perfil del usuario autenticado consultando estrictamente la base de datos."""
    stmt = select(Usuario).where(Usuario.id == current_user["user_id"])
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not user.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión no es válida o el usuario ha sido desactivado."
        )

    return UserResponse(
        id=str(user.id),
        email=user.email,
        nombre_completo=user.nombre_completo,
        rol=str(user.rol),
        empresa_id=str(user.empresa_id),
        totp_enabled=bool(user.totp_enabled)
    )
