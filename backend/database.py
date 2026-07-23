"""
Database module for PostgreSQL connection using SQLAlchemy.
Connects to Cloud SQL PostgreSQL for loan application storage.
"""

import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Database configuration with fallbacks
DB_HOST = os.getenv("DB_HOST", "")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "loan_db")

# SQLAlchemy Base for models
Base = declarative_base()

# Synchronous database URL for initial setup
SYNC_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Async database URL for application use
ASYNC_DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create sync engine for database creation
sync_engine = create_engine(
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/postgres",
    isolation_level="AUTOCOMMIT"
)

# Create async engine for application use
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)


def create_database_if_not_exists():
    """
    Create the loan_db database if it doesn't exist.
    """
    try:
        with sync_engine.connect() as conn:
            # Check if database exists
            result = conn.execute(
                text(f"SELECT 1 FROM pg_database WHERE datname = '{DB_NAME}'")
            )
            exists = result.fetchone() is not None
            
            if not exists:
                logger.info(f"Creating database: {DB_NAME}")
                conn.execute(text(f'CREATE DATABASE "{DB_NAME}"'))
                logger.info(f"Database {DB_NAME} created successfully")
            else:
                logger.info(f"Database {DB_NAME} already exists")
                
    except Exception as e:
        logger.error(f"Error creating database: {e}")
        raise


async def init_db():
    """
    Initialize the database by creating all tables.
    Must be called after importing models.
    """
    try:
        # First, ensure database exists
        create_database_if_not_exists()
        
        # Import models to register them with Base
        from models import LoanApplication, OTPVerification
        
        # Create all tables
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        logger.info("Database tables created successfully")
        
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise


async def get_db():
    """
    Dependency to get database session.
    Use with FastAPI's Depends().
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def close_db():
    """
    Close database connections on shutdown.
    """
    await async_engine.dispose()
    logger.info("Database connections closed")
