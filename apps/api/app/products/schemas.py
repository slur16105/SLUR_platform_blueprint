import uuid

from pydantic import BaseModel, Field, field_validator


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
