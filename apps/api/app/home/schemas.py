import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# ── 공개 조회 (GET /home) ────────────────────────────────────────────


class HomeFeatureProduct(BaseModel):
    """편성 품목의 공개 표현 — products 공개 필드와 동일 형태 (service._public_fields 재사용)."""

    id: uuid.UUID
    name: str
    brand_name: str
    price_from: int  # 활성 조합 최저가 (백엔드 계산)
    main_image_url: str | None
    sold_out: bool


class FeatureOut(BaseModel):
    id: uuid.UUID
    kind: str  # 'hero' | 'slot'
    issue_no: str | None
    issue_label: str | None
    title: str
    lead_text: str | None
    image_url: str | None  # image_path → _image_url 변환
    layout: str  # 'feature' | 'strip'
    items: list[HomeFeatureProduct]


class HomeResponse(BaseModel):
    hero: FeatureOut | None  # 활성 hero 없으면 null (프론트 서문형 폴백)
    slots: list[FeatureOut]


# ── 관리자 CRUD (/admin/home/features) ───────────────────────────────


class FeatureCreate(BaseModel):
    kind: Literal["hero", "slot"]
    layout: Literal["feature", "strip"]
    title: str = Field(min_length=1, max_length=120)
    issue_no: str | None = Field(default=None, max_length=20)
    issue_label: str | None = Field(default=None, max_length=20)
    lead_text: str | None = Field(default=None, max_length=5000)
    image_path: str | None = Field(default=None, max_length=300)
    display_order: int = Field(default=0, ge=0, le=1_000_000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool = True
    product_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)  # 순서 = 리스트 인덱스

    @field_validator("title")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("제목을 입력해 주세요.")
        return v

    @field_validator("product_ids")
    @classmethod
    def no_duplicate(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(set(v)) != len(v):
            raise ValueError("중복된 상품이 있습니다.")
        return v

    @model_validator(mode="after")
    def check_window(self) -> "FeatureCreate":
        # 둘 다 지정됐는데 종료가 시작 이하면 편성이 조용히 사라진다 — 프론트뿐 아니라 여기서도 막는다.
        if self.starts_at is not None and self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("노출 종료가 시작보다 빠를 수 없습니다.")
        return self


class FeatureUpdate(BaseModel):
    """PATCH — 전달된 필드만 갱신. product_ids가 전달되면 편성 품목 전량 교체."""

    kind: Literal["hero", "slot"] | None = None
    layout: Literal["feature", "strip"] | None = None
    title: str | None = Field(default=None, min_length=1, max_length=120)
    issue_no: str | None = Field(default=None, max_length=20)
    issue_label: str | None = Field(default=None, max_length=20)
    lead_text: str | None = Field(default=None, max_length=5000)
    image_path: str | None = Field(default=None, max_length=300)
    display_order: int | None = Field(default=None, ge=0, le=1_000_000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool | None = None
    product_ids: list[uuid.UUID] | None = Field(default=None, max_length=200)

    @field_validator("title")
    @classmethod
    def not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("제목을 입력해 주세요.")
        return v

    @field_validator("product_ids")
    @classmethod
    def no_duplicate(cls, v: list[uuid.UUID] | None) -> list[uuid.UUID] | None:
        if v is not None and len(set(v)) != len(v):
            raise ValueError("중복된 상품이 있습니다.")
        return v

    @model_validator(mode="after")
    def check_window(self) -> "FeatureUpdate":
        # 부분 수정이라 둘 다 전달됐을 때만 검증한다(한쪽만 바꾸는 경우는 통과).
        if self.starts_at is not None and self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("노출 종료가 시작보다 빠를 수 없습니다.")
        return self


class AdminFeatureItem(BaseModel):
    id: uuid.UUID  # home_feature_items row id
    product_id: uuid.UUID
    sort_order: int
    name: str
    brand_name: str
    price_from: int
    main_image_url: str | None
    sold_out: bool


class AdminFeatureResponse(BaseModel):
    id: uuid.UUID
    kind: str
    issue_no: str | None
    issue_label: str | None
    title: str
    lead_text: str | None
    image_path: str | None
    image_url: str | None
    layout: str
    display_order: int
    starts_at: datetime | None
    ends_at: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    items: list[AdminFeatureItem]


class AdminFeatureListItem(BaseModel):
    id: uuid.UUID
    kind: str
    title: str
    issue_no: str | None
    issue_label: str | None
    layout: str
    display_order: int
    is_active: bool
    starts_at: datetime | None
    ends_at: datetime | None
    display_state: str  # live | scheduled | ended | off — 토글 + 노출기간을 합친 실제 노출 상태
    item_count: int
    updated_at: datetime


class AdminFeatureList(BaseModel):
    items: list[AdminFeatureListItem]
