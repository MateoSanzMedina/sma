#!/usr/bin/env python
"""
Script Administrativo CLI: Creación o Reseteo Seguro de Super Administrador (OWASP A07)
Constructora Serving S.A.S. - SMA Platform

Uso:
  # Con la base de datos de producción (Render / Supabase / Neon):
  python backend/create_superuser.py --email admin@serving.com.co --password "TuClaveSegura2026!" --name "Mateo Sanz" --db-url "postgresql+asyncpg://usuario:pass@host:5432/sma_db"

  # Con PostgreSQL local en tu PC:
  python backend/create_superuser.py --email admin@serving.com.co --password "TuClaveSegura2026!" --name "Mateo Sanz" --db-url "postgresql+asyncpg://postgres:TU_PASS_LOCAL@localhost:5432/postgres"

  # Con SQLite local para pruebas inmediatas sin Docker ni Postgres:
  python backend/create_superuser.py --email admin@serving.com.co --password "TuClaveSegura2026!" --name "Mateo Sanz" --sqlite
"""

import asyncio
import argparse
import os
import sys
import secrets
import string

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.db.session import Base
from app.models.models import Empresa, Usuario
from app.core.security import hash_password
from app.core.config import settings

async def generate_random_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    return "".join(secrets.choice(alphabet) for _ in range(length))

def format_db_url(raw_url: str) -> str:
    url = raw_url.strip()
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("sqlite://") and not url.startswith("sqlite+aiosqlite://"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return url

async def main():
    parser = argparse.ArgumentParser(description="Crear o actualizar Super Administrador en SMA")
    parser.add_argument("--email", default=os.getenv("SUPERADMIN_EMAIL", "admin@serving.com.co"), help="Correo del super usuario")
    parser.add_argument("--password", default=os.getenv("SUPERADMIN_PASSWORD"), help="Contraseña segura (si se omite, se genera aleatoriamente)")
    parser.add_argument("--name", default="Super Administrador Serving", help="Nombre completo")
    parser.add_argument("--nit", default="900123456-1", help="NIT de la Empresa")
    parser.add_argument("--db-url", default=None, help="Cadena de conexión directa a PostgreSQL o SQLite")
    parser.add_argument("--sqlite", action="store_true", help="Usar base de datos SQLite local rápida para pruebas inmediatas")
    args = parser.parse_args()

    clean_email = args.email.strip().lower()
    clean_pass = (args.password or "").strip()

    if not clean_pass:
        clean_pass = await generate_random_password()
        generated = True
    else:
        generated = False

    if len(clean_pass) < 10:
        print("[ERROR] La contraseña debe tener al menos 10 caracteres.")
        sys.exit(1)

    # Determinar URL de conexión
    if args.sqlite:
        target_db_url = "sqlite+aiosqlite:///./backend/sma_local.db"
    elif args.db_url:
        target_db_url = format_db_url(args.db_url)
    elif os.getenv("DATABASE_URL"):
        target_db_url = format_db_url(os.getenv("DATABASE_URL"))
    else:
        target_db_url = format_db_url(settings.DATABASE_URL)

    # Ocultar contraseña en el log informativo
    masked_url = target_db_url
    if "@" in target_db_url and ":" in target_db_url:
        try:
            proto, rest = target_db_url.split("://", 1)
            creds, host_part = rest.split("@", 1)
            user = creds.split(":")[0]
            masked_url = f"{proto}://{user}:****@{host_part}"
        except Exception:
            masked_url = target_db_url

    print(f"[*] Conectando a la base de datos ({masked_url}) para registrar super usuario: {clean_email}...")

    connect_args = {}
    if "asyncpg" in target_db_url:
        connect_args["statement_cache_size"] = 0

    engine = create_async_engine(target_db_url, future=True, connect_args=connect_args)
    SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    # Crear tablas si no existen
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as conn_err:
        print("\n" + "!"*65)
        print("  [ERROR DE CONEXIÓN A BASE DE DATOS]")
        print("!"*65)
        print(f"Detalle del error: {conn_err}")
        print("\nOpciones de solución:")
        print("1. Para usar la base de datos PostgreSQL local instalada en tu PC:")
        print("   python backend/create_superuser.py --db-url \"postgresql+asyncpg://postgres:TU_PASSWORD_LOCAL@localhost:5432/postgres\"")
        print("\n2. Para conectar a la base de datos de producción (Render / Supabase / Neon):")
        print("   python backend/create_superuser.py --db-url \"postgresql+asyncpg://usuario:password@host.render.com:5432/sma_db?ssl=require\"")
        print("\n3. Para crear el super usuario de forma inmediata en SQLite local (sin Docker ni PostgreSQL):")
        print("   python backend/create_superuser.py --sqlite")
        print("!"*65 + "\n")
        sys.exit(1)

    async with SessionLocal() as session:
        # 1. Obtener o crear empresa
        res_empresa = await session.execute(select(Empresa).where(Empresa.nit == args.nit))
        empresa = res_empresa.scalar_one_or_none()

        if not empresa:
            print("[+] Creando registro de Empresa: Constructora Serving S.A.S...")
            empresa = Empresa(
                nit=args.nit,
                razon_social="Constructora Serving S.A.S.",
                direccion="Calle Principal #45-12, Medellín, Colombia",
                telefono="+57 604 444 5566"
            )
            session.add(empresa)
            await session.commit()
            await session.refresh(empresa)

        # 2. Verificar si el usuario ya existe
        res_user = await session.execute(select(Usuario).where(Usuario.email == clean_email))
        user = res_user.scalar_one_or_none()

        hashed_pwd = hash_password(clean_pass)

        if not user:
            print(f"[+] Creando nuevo Super Administrador ({clean_email})...")
            user = Usuario(
                email=clean_email,
                password_hash=hashed_pwd,
                nombre_completo=args.name,
                rol="ADMIN",
                empresa_id=empresa.id,
                activo=True
            )
            session.add(user)
        else:
            print(f"[*] El usuario {clean_email} ya existe. Actualizando contraseña y rol ADMIN...")
            user.password_hash = hashed_pwd
            user.rol = "ADMIN"
            user.activo = True
            user.failed_login_attempts = 0
            user.locked_until = None

        await session.commit()
        await session.refresh(user)

    await engine.dispose()

    print("\n" + "="*60)
    print("  SUPER ADMINISTRADOR CONFIGURADO CON ÉXITO")
    print("="*60)
    print(f"  ID:         {user.id}")
    print(f"  Email:      {user.email}")
    print(f"  Nombre:     {user.nombre_completo}")
    print(f"  Rol:        {user.rol}")
    print(f"  Estado:     Activo")
    if generated:
        print(f"  Password:   {clean_pass}")
        print("  [AVISO] Guarde esta contraseña en su gestor seguro de credenciales.")
    print("="*60 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
