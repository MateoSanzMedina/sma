from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.db.session import get_db
from app.models.models import Usuario, Empresa, SecurityAuditLog
from app.core.security import hash_password, verify_password, create_access_token, get_current_user, RoleChecker
from typing import Optional

router = APIRouter()

class LoginRequest(BaseModel):
    email: EmailStr
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

class RegisterUserRequest(BaseModel):
    email: EmailStr
    password: str
    nombre_completo: str
    rol: str
    nit_empresa: str
    razon_social_empresa: str

@router.post("/login", response_model=TokenResponse)
async def login(request_data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Endpoint de Login seguro con protección OWASP A07 (Rate limit, password hash verification & audit log)."""
    ip_address = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Desconocido")
    
    # Buscar usuario por email (evita SQL Injection al usar SQLAlchemy parameterized query)
    stmt = select(Usuario).where(Usuario.email == request_data.email.lower().strip())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not user.activo:
        # Registrar intento fallido
        sec_log = SecurityAuditLog(
            ip_address=ip_address,
            user_agent=user_agent,
            evento="LOGIN_FAILED",
            detalle={"email_intent": request_data.email, "reason": "Usuario no encontrado o inactivo"}
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
            detail="Cuenta temporalmente bloqueada por múltiples intentos fallidos. Intente más tarde."
        )
        
    if not verify_password(request_data.password, user.password_hash):
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
        
    # Resetear intentos fallidos y actualizar último login
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
    
    # Generar Token JWT
    token_payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.rol,
        "empresa_id": user.empresa_id
    }
    access_token = create_access_token(data=token_payload)
    
    user_resp = UserResponse(
        id=user.id,
        email=user.email,
        nombre_completo=user.nombre_completo,
        rol=user.rol,
        empresa_id=user.empresa_id
    )
    
    return TokenResponse(access_token=access_token, user=user_resp)

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
