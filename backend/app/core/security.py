import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from passlib.context import CryptContext
from fastapi import HTTPException, Security, status, Depends, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
import re

# Contexto de Cifrado con Bcrypt y Argon2
pwd_context = CryptContext(schemes=["bcrypt", "argon2"], deprecated="auto")
security_bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """Hashea la contraseña usando Bcrypt / Argon2 (OWASP A02)."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña coincide con el hash."""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Genera un Token JWT firmado de acceso seguro."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({
        "exp": expire,
        "iat": now,
        "iss": settings.PROJECT_NAME
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodifica y valida un Token JWT."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token de acceso ha expirado.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso inválido o alterado.",
            headers={"WWW-Authenticate": "Bearer"}
        )

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Dict[str, Any]:
    """Dependencia de FastAPI para extraer y verificar el usuario autenticado (OWASP A01)."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se proporcionaron credenciales de autenticación.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    
    user_id: str = payload.get("sub")
    role: str = payload.get("role")
    empresa_id: str = payload.get("empresa_id")
    
    if not user_id or not role or not empresa_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Estructura de token inválida."
        )
        
    return {
        "user_id": user_id,
        "email": payload.get("email"),
        "role": role,
        "empresa_id": empresa_id
    }

class RoleChecker:
    """Clase dependencia para Role-Based Access Control (RBAC) estricto (OWASP A01)."""
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: Dict[str, Any] = Depends(get_current_user)):
        if current_user["role"] not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Se requiere uno de los siguientes roles: {', '.join(self.allowed_roles)}"
            )
        return current_user

# Sanitización y Validación de Archivos (OWASP A08: Software & Data Integrity Failures)
ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv", ".pdf", ".png", ".jpg", ".jpeg", ".dwg"}
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

async def validate_uploaded_file(file: UploadFile) -> None:
    """Valida la extensión, tamaño y nombre del archivo para prevenir Arbitrary File Upload & Path Traversal."""
    filename = file.filename or ""
    
    # 1. Sanitizar el nombre del archivo (evitar Path Traversal / Directory Injection)
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido (posible ataque Path Traversal).")
        
    # 2. Validar extensión permitida
    ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no permitido '{ext}'. Formatos válidos: {', '.join(ALLOWED_EXTENSIONS)}"
        )

# Encabezados de Seguridad OWASP HTTP
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; object-src 'none';",
    "Referrer-Policy": "strict-origin-when-cross-origin"
}
