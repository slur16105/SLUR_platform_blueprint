import uuid
from typing import Literal

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


class VariantInput(BaseModel):
    option1_name: str = Field(default="", max_length=20)
    option1_value: str = Field(default="", max_length=30)
    option2_name: str = Field(default="", max_length=20)
    option2_value: str = Field(default="", max_length=30)
    extra_price: int = Field(ge=-1_000_000, le=1_000_000)
    stock: int = Field(ge=0, le=1_000_000)
    is_active: bool = True


class VariantsReplace(BaseModel):
    variants: list[VariantInput] = Field(min_length=1)

    @field_validator("variants")
    @classmethod
    def within_cap_and_unique(cls, v: list[VariantInput]) -> list[VariantInput]:
        cap = get_settings().max_variants
        if len(v) > cap:
            raise ValueError(f"옵션 조합은 최대 {cap}개까지입니다.")
        combos = [(x.option1_value.strip(), x.option2_value.strip()) for x in v]
        if len(set(combos)) != len(combos):
            raise ValueError("중복된 옵션 조합이 있습니다.")
        # 그리드 정합성: 축 이름은 전 행 동일, 값과 이름은 짝으로 (혼재 데이터가 구매자 UI로 상속되는 것 방지)
        names1 = {x.option1_name.strip() for x in v}
        names2 = {x.option2_name.strip() for x in v}
        if len(names1) > 1 or len(names2) > 1:
            raise ValueError("옵션 이름이 행마다 다릅니다. 조합을 다시 만들어 주세요.")
        n1, n2 = names1.pop(), names2.pop()
        for x in v:
            has_v1, has_v2 = bool(x.option1_value.strip()), bool(x.option2_value.strip())
            if bool(n1) != has_v1 or bool(n2) != has_v2:
                raise ValueError("옵션 이름과 값이 짝이 맞지 않습니다.")
        if not n1 and len(v) > 1:
            raise ValueError("옵션 없는 상품의 조합은 1개여야 합니다.")
        return v


class VariantResponse(VariantInput):
    id: uuid.UUID


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_price: int = Field(ge=0, le=100_000_000)
    description: str = Field(min_length=1, max_length=5000)
    category_id: uuid.UUID
    image_paths: list[str] = Field(min_length=1)  # [0] = 대표
    stock: int = Field(default=0, ge=0, le=1_000_000)  # 옵션 없는 상품의 기본 조합 재고 (AC 2)

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
    variants: list[VariantResponse] = []


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    base_price: int | None = Field(default=None, ge=0, le=100_000_000)
    description: str | None = Field(default=None, min_length=1, max_length=5000)
    category_id: uuid.UUID | None = None
    status: Literal["active", "soldout", "hidden"] | None = None

    @field_validator("name", "description")
    @classmethod
    def not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("필수 입력입니다.")
        return v
