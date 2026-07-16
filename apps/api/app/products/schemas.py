import uuid

from pydantic import BaseModel, Field, field_validator

from app.core.config import get_settings


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)

    @field_validator("name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("카테고리 이름을 입력해 주세요.")
        return v


class CategoryRename(CategoryCreate):
    pass


class CategoryOrder(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    sort_order: int


class PresignRequest(BaseModel):
    content_type: str = Field(min_length=1, max_length=50)


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_price: int = Field(ge=0, le=100_000_000)
    description: str = Field(min_length=1, max_length=5000)
    category_id: uuid.UUID
    image_paths: list[str] = Field(min_length=1)  # [0] = 대표

    @field_validator("name", "description")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("필수 입력입니다.")
        return v

    @field_validator("image_paths")
    @classmethod
    def image_count(cls, v: list[str]) -> list[str]:
        cap = 1 + get_settings().max_extra_images
        if len(v) > cap:
            raise ValueError(f"이미지는 대표 1장 포함 최대 {cap}장까지입니다.")
        if len(set(v)) != len(v):
            raise ValueError("중복된 이미지가 있습니다.")
        return v


class ProductImageResponse(BaseModel):
    path: str
    sort_order: int


class ProductResponse(BaseModel):
    id: uuid.UUID
    name: str
    base_price: int
    description: str
    status: str
    category_id: uuid.UUID
    images: list[ProductImageResponse] = []
