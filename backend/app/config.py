from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_key: str = ""

    # Database
    database_url: str = ""

    # Supabase Storage
    supabase_storage_bucket: str = "queryflow-files"

    # Redis (Railway injects REDIS_URL automatically)
    redis_url: str = "redis://localhost:6379"

    # Anthropic
    anthropic_api_key: str = ""

    # App
    frontend_url: str = "http://localhost:5173"

    # Limits
    max_rows_free: int = 50_000
    max_rows_pro: int = 500_000


settings = Settings()
