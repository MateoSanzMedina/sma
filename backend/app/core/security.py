import jwt
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
import bcrypt
from fastapi import HTTPException, Security, status, Depends, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
import re
import pyotp


security_bearer = HTTPBearer(auto_error=False)

def validate_password_complexity(password: str) -> None:
    """Valida los requisitos mínimos de seguridad para contraseñas (OWASP A07).
    - Mínimo 8 caracteres.
    - Al menos una letra mayúscula.
    - Al menos una letra minúscula.
    - Al menos un número.
    - Al menos un carácter especial (!@#$%^&*...).
    """
    if not password or len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 8 caracteres."
        )
    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe incluir al menos una letra mayúscula."
        )
    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe incluir al menos una letra minúscula."
        )
    if not re.search(r"\d", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe incluir al menos un número."
        )
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?~`]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe incluir al menos un carácter especial (ej: !@#$%^&*)."
        )

def hash_password(password: str) -> str:
    """Hashea la contraseña usando Bcrypt con salt seguro y truncado a 72 bytes (OWASP A02)."""
    if not password:
        raise ValueError("La contraseña no puede estar vacía.")
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña coincide con el hash almacenado de forma segura."""
    if not plain_password or not hashed_password:
        return False
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Genera un Token JWT firmado de acceso seguro serializando objetos UUID a string."""
    to_encode = {}
    for k, v in data.items():
        if isinstance(v, uuid.UUID) or (hasattr(v, "hex") and hasattr(v, "urn")):
            to_encode[k] = str(v)
        else:
            to_encode[k] = v

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

def create_temp_2fa_token(user_id: Any, email: str) -> str:
    """Genera un token temporal de 5 minutos únicamente válido para verificación 2FA."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.TEMP_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "purpose": "2fa_pending",
        "iat": now,
        "exp": expire,
        "iss": settings.PROJECT_NAME
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_temp_2fa_token(token: str) -> Dict[str, Any]:
    """Valida que el token temporal de 2FA sea legítimo y no haya expirado."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("purpose") != "2fa_pending":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token 2FA inválido.")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="El código de verificación temporal ha expirado. Inicie sesión nuevamente.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token 2FA inválido o alterado.")

def generate_totp_secret() -> str:
    """Genera una clave secreta base32 única para el usuario."""
    return pyotp.random_base32()

def get_totp_uri(secret: str, email: str) -> str:
    """Genera el URI estándar otpauth:// compatible con Google Authenticator."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=settings.PROJECT_NAME)

def verify_totp_code(secret: str, code: str) -> bool:
    """Verifica el código de 6 dígitos con ventana de tolerancia de ±30 segundos."""
    if not secret or not code:
        return False
    clean_code = str(code).strip().replace(" ", "")
    totp = pyotp.TOTP(secret)
    return totp.verify(clean_code, valid_window=1)


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
