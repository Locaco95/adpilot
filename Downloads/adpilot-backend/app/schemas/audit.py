from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class AuditLogOut(BaseModel):
    id: UUID
    timestamp: datetime
    action: str
    tier: int | None
    detail: str | None
    actor: str


class AuditLogPage(BaseModel):
    items: list[AuditLogOut]
    total: int
    has_more: bool
