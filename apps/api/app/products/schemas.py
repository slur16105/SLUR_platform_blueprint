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


class CategoryAdminItem(CategoryResponse):
    """관리자 카테고리 패널용 — 소속 상품 수(삭제 가능 여부와 같은 기준)를 더한다."""

    product_count: int


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
    # 화면이 Storage 주소를 조립하지 않게 서버가 완성된 URL을 준다 — 판매자 콘솔이
    # Supabase 주소를 상수로 박아두던 것을 없애기 위함. Storage 미연결 환경은 None/데모.
    url: str | None = None


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


class PublicVariant(BaseModel):
    id: uuid.UUID
    option1_name: str
    option1_value: str
    option2_name: str
    option2_value: str
    final_price: int  # base + extra — 백엔드 계산 (AD-12)
    purchasable: bool  # 단일 술어 결과 (AD-10)


class PublicProductItem(BaseModel):
    id: uuid.UUID
    name: str
    brand_name: str
    price_from: int  # 활성 조합 최저가 (백엔드 계산)
    main_image_url: str | None
    sold_out: bool
    category_id: uuid.UUID


class PublicProductList(BaseModel):
    items: list[PublicProductItem]
    total: int
    page: int


class SellerInfo(BaseModel):
    """법정 판매자 신원정보 (FR-32 — 전자상거래법 공개 의무, 인증 불요)."""

    brand_name: str
    company_name: str
    representative_name: str
    business_registration_number: str
    mail_order_number: str
    business_address: str
    contact_phone: str


class PublicProductDetail(PublicProductItem):
    description: str
    image_urls: list[str]
    variants: list[PublicVariant]
    seller_info: SellerInfo  # 판매자 정보 접이식 영역 (6.2)
