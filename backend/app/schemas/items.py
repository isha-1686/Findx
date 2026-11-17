from typing import Literal
from pydantic import BaseModel, Field


CATEGORIES = Literal[
    "bag", "book", "card", "earphone", "key",
    "lipstick", "phone", "umbrella", "usbflashdisk", "vacuumcup", "other"
]


class ItemCreate(BaseModel):
    type: Literal["lost", "found"]
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=2000)
    location: str = Field(min_length=1, max_length=200)
    category: str | None = None
    contact_info: str | None = Field(default=None, max_length=200)


class ItemResponse(BaseModel):
    id: str
    type: str
    title: str
    description: str
    location: str
    category: str | None
    image_url: str | None
    status: str
    contact_info: str | None
    created_at: str


class MatchRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    category: str | None = None
    location: str | None = None
    top_k: int = Field(default=5, ge=1, le=20)
