import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import AsyncSessionLocal, engine, Base
from app.models.models import Empresa, Usuario
from app.core.security import hash_password

import os
import secrets
import string

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sma.init_db")

async def init_db():
    logger.info("Verificando y creando tablas en la base de datos...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        # 1. Crear Empresa por defecto: Constructora Serving S.A.S.
        stmt_empresa = select(Empresa).where(Empresa.nit == "900123456-1")
        res_empresa = await session.execute(stmt_empresa)
        empresa = res_empresa.scalar_one_or_none()
        
        if not empresa:
            logger.info("Creando registro inicial de empresa: Constructora Serving S.A.S...")
            empresa = Empresa(
                nit="900123456-1",
                razon_social="Constructora Serving S.A.S.",
                direccion="Calle Principal #45-12, Medellín, Colombia",
                telefono="+57 604 444 5566"
            )
            session.add(empresa)
            await session.commit()
            await session.refresh(empresa)
            logger.info(f"Empresa creada con ID: {empresa.id}")

        # 2. Inicializar Administrador Principal Serving
        admin_email = os.getenv("SUPERADMIN_EMAIL", "admin@serving.com.co").strip().lower()
        admin_pass = os.getenv("SUPERADMIN_PASSWORD", "Serving2026*SecureAdmin!")
        
        stmt_admin = select(Usuario).where(Usuario.email == admin_email)
        res_admin = await session.execute(stmt_admin)
        admin = res_admin.scalar_one_or_none()
        
        if not admin:
            logger.info(f"Creando usuario Administrador inicial ({admin_email})...")
            hashed_pwd = hash_password(admin_pass)
            admin = Usuario(
                email=admin_email,
                password_hash=hashed_pwd,
                nombre_completo="Administrador General Serving",
                rol="ADMIN",
                empresa_id=empresa.id,
                activo=True
            )
            session.add(admin)
            await session.commit()
            logger.info(f"Usuario Administrador ({admin_email}) inicializado con éxito.")
        else:
            logger.info(f"Usuario Administrador ({admin_email}) ya existe.")

if __name__ == "__main__":
    asyncio.run(init_db())
