import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import get_current_user_id, require_role
from app.products import service as products_service
from app.products import storage as products_storage
from app.products.schemas import PresignRequest, ProductCreate, ProductImageResponse, ProductResponse, VariantResponse, VariantsReplace
from app.sellers import service
from app.sellers.schemas import ApplicationRequest, ApplicationResponse, SellerMeResponse, ShippingFees

router = APIRouter(prefix="/sellers")


@router.post("/applications", response_model=ApplicationResponse, status_code=201)
async def submit_application(
    body: ApplicationRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ApplicationResponse:
    app_row = await service.submit_application(session, user_id, body)
    return ApplicationResponse.model_validate(app_row, from_attributes=True)


@router.get("/applications/me", response_model=ApplicationResponse)
async def my_application(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ApplicationResponse:
    app_row = await service.my_latest_application(session, user_id)
    if app_row is None:
        raise AppError("not_found", "신청 내역이 없습니다.", status_code=404)
    return ApplicationResponse.model_validate(app_row, from_attributes=True)


@router.get("/me", response_model=SellerMeResponse)
async def my_profile(
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> SellerMeResponse:
    seller = await service.get_my_seller(session, user_id)
    return SellerMeResponse.model_validate(seller, from_attributes=True)


@router.put("/me/shipping-fees", response_model=SellerMeResponse)
async def update_shipping_fees(
    body: ShippingFees,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> SellerMeResponse:
    seller = await service.update_shipping_fees(
        session, user_id, body.base_shipping_fee, body.jeju_extra_fee, body.island_extra_fee
    )
    return SellerMeResponse.model_validate(seller, from_attributes=True)


def _product_response(product, images, variants=()) -> ProductResponse:
    return ProductResponse(
        id=product.id, name=product.name, base_price=product.base_price, description=product.description,
        status=product.status, category_id=product.category_id,
        images=[ProductImageResponse(path=i.path, sort_order=i.sort_order) for i in images],
        variants=[VariantResponse.model_validate(v, from_attributes=True) for v in variants],
    )


@router.post("/products/images/presign")
async def presign_image(
    body: PresignRequest,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    seller = await service.get_my_seller(session, user_id)
    return await products_storage.create_signed_upload(seller.id, body.content_type)


@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(
    body: ProductCreate,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> ProductResponse:
    seller = await service.get_my_seller(session, user_id)
    product = await products_service.create_product(session, seller.id, body)
    images = (await products_service.get_product_images(session, [product.id])).get(product.id, [])
    variants = (await products_service.get_variants(session, [product.id])).get(product.id, [])
    return _product_response(product, images, variants)


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> list[ProductResponse]:
    seller = await service.get_my_seller(session, user_id)
    rows = await products_service.list_my_products(session, seller.id)
    ids = [p.id for p in rows]
    images = await products_service.get_product_images(session, ids)
    variants = await products_service.get_variants(session, ids)
    return [_product_response(p, images.get(p.id, []), variants.get(p.id, [])) for p in rows]


@router.put("/products/{product_id}/variants", response_model=ProductResponse)
async def replace_variants(
    product_id: uuid.UUID,
    body: VariantsReplace,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> ProductResponse:
    seller = await service.get_my_seller(session, user_id)
    product = await products_service.replace_variants(session, seller.id, product_id, body.variants)
    images = (await products_service.get_product_images(session, [product.id])).get(product.id, [])
    variants = (await products_service.get_variants(session, [product.id])).get(product.id, [])
    return _product_response(product, images, variants)
