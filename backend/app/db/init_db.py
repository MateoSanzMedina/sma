import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import AsyncSessionLocal, engine, Base
from app.models.models import Empresa, Usuario
from app.core.security import hash_password

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
            
        # 2. Crear Super Administrador: ChainPoint
        stmt_cp = select(Usuario).where(Usuario.email == "chainpoint@serving.com.co")
        res_cp = await session.execute(stmt_cp)
        cp_user = res_cp.scalar_one_or_none()

        if not cp_user:
            logger.info("Creando Super Administrador (ChainPoint)...")
            cp_user = Usuario(
                email="chainpoint@serving.com.co",
                password_hash=hash_password("ChainPoint2026."),
                nombre_completo="ChainPoint Super Admin",
                rol="ADMIN",
                empresa_id=empresa.id,
                activo=True
            )
            session.add(cp_user)
            await session.commit()
            logger.info("Super Admin ChainPoint creado -> Usuario: ChainPoint | Pass: ChainPoint2026.")
        else:
            cp_user.password_hash = hash_password("ChainPoint2026.")
            await session.commit()
            logger.info("Super Admin ChainPoint actualizado.")

        # 3. Crear Administrador Secundario Serving
        stmt_admin = select(Usuario).where(Usuario.email == "admin@serving.com.co")
        res_admin = await session.execute(stmt_admin)
        admin = res_admin.scalar_one_or_none()
        
        if not admin:
            logger.info("Creando usuario Administrador inicial (admin@serving.com.co)...")
            hashed_pwd = hash_password("Serving2026*SecureAdmin!")
            admin = Usuario(
                email="admin@serving.com.co",
                password_hash=hashed_pwd,
                nombre_completo="Administrador General Serving",
                rol="ADMIN",
                empresa_id=empresa.id,
                activo=True
            )
            session.add(admin)
            await session.commit()
            logger.info("Usuario Administrador Serving creado con éxito.")

if __name__ == "__main__":
    asyncio.run(init_db())
