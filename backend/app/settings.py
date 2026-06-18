from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""
    database_url: str = ""          # postgresql+asyncpg://...

    # JWT (Supabase JWT secret)
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24h

    # Claude
    claude_api_key: str = ""

    # Meta
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_access_token: str = ""
    meta_ad_account_id: str = ""
    meta_page_id: str = ""  # Facebook Page that ad creatives post from (required for the ad/creative layer)

    # TikTok
    tiktok_access_token: str = ""
    tiktok_advertiser_id: str = ""

    # Snapchat
    snapchat_access_token: str = ""           # unused; kept for back-compat
    snapchat_ad_account_id: str = ""
    snapchat_client_id: str = ""
    snapchat_client_secret: str = ""
    snapchat_refresh_token: str = ""
    snapchat_redirect_uri: str = ""
    snapchat_org_id_loay: str = ""            # org that owns the public profile + ad account
    snapchat_profile_id: str = ""             # optional override; else discovered from the org

    # Shopify
    shopify_shop_url: str = ""
    shopify_api_key: str = ""
    shopify_api_secret: str = ""
    shopify_webhook_secret: str = ""

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    telegram_webhook_secret: str = ""

    # LLM (OpenRouter)
    openrouter_api_key: str = ""
    llm_model: str = "openai/gpt-4o-mini"

    # Google Drive (OAuth)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect: str = ""
    # Shared folder all creatives are uploaded into — the media library source.
    default_creative_folder_id: str = "11mvbN_Gr1wKP7-F8rCTWeASsLCZ-dQYn"

    # App
    environment: str = "development"
    config_path: str = "config/thresholds.yaml"


@lru_cache
def get_settings() -> Settings:
    return Settings()
