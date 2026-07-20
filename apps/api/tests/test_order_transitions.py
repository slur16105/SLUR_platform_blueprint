"""주문 상태 전이 엔진 테스트 (Story 4.3).

주문 생성 API는 4.4 몫이므로 픽스처는 orders 도메인 모델로 직접 구성한다
(4.6 AC의 "전이 함수 직접 호출로 상태 조성" 관례). 엔진 테스트는 API 비의존 유지.
"""

import ast
import uuid as u
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import select, text

from app.core.errors import AppError
from app.orders import service, transitions as t
from app.orders.models import Cancellation, Order, OrderEvent, OrderItem, SubOrder
from tests.test_carts import _buyer, _shop
from tests.test_seller_application import _auth  # noqa: F401 — _shop 의존
from tests.test_products import clean_products  # noqa: F401


async def _user_id(client, email: str) -> u.UUID:
    from app.core.db import engine

    async with engine.begin() as conn:
        return (await conn.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email})).scalar_one()


async def _order_fixture(client, *, n_sellers_stock: int = 5, qty: int = 2):
    """구매자·판매자·상품(API 경유) + Order/SubOrder/OrderItem 직접 INSERT.

    반환: (session_factory 재사용을 위해) dict — order_id, sub_order_id, item_id, variant_id, buyer_id, seller_id, qty
    """
    from app.core.db import async_session_factory, engine

    await _buyer(client, email="engine-buyer@example.com")
    buyer_id = await _user_id(client, "engine-buyer@example.com")
    _, pid, vs = await _shop(client, stock=n_sellers_stock)
    async with engine.begin() as conn:
        seller_id = (await conn.execute(text("SELECT id FROM sellers LIMIT 1"))).scalar_one()

    async with async_session_factory() as session:
        order = Order(
            user_id=buyer_id, recipient_name="수령인", recipient_phone="01012345678",
            postal_code="06236", address1="서울시 강남구", address2="", order_note="",
            deposit_due_at=datetime.now(timezone.utc) + timedelta(days=3),
        )
        session.add(order)
        await session.flush()
        sub = SubOrder(order_id=order.id, seller_id=seller_id, shipping_fee=3000, remote_extra_fee=0)
        session.add(sub)
        await session.flush()
        item = OrderItem(
            sub_order_id=sub.id, variant_id=u.UUID(vs[0]["id"]), product_name="결 좋은 엽서",
            option_text="색상: 블랙 / 사이즈: L", unit_price=3000, extra_price=vs[0]["extra_price"], quantity=qty,
        )
        session.add(item)
        await session.commit()
        return {
            "order_id": order.id, "sub_order_id": sub.id, "item_id": item.id,
            "variant_id": u.UUID(vs[0]["id"]), "buyer_id": buyer_id, "seller_id": seller_id, "qty": qty,
        }


async def _stock(variant_id: u.UUID) -> int:
    from app.core.db import engine

    async with engine.begin() as conn:
        return (await conn.execute(text("SELECT stock FROM variants WHERE id = :v"), {"v": variant_id})).scalar_one()


async def _events(order_id: u.UUID) -> list[OrderEvent]:
    from app.core.db import async_session_factory

    async with async_session_factory() as session:
        return list(await session.scalars(
            select(OrderEvent).where(OrderEvent.order_id == order_id).order_by(OrderEvent.created_at, OrderEvent.id)
        ))


@pytest.mark.asyncio
async def test_paid_cascade_and_events(client, clean_products):
    """AC 1·4: paid 전이가 sub_orders 연쇄 preparing + paid_at + 전이별 order_events."""
    from app.core.db import async_session_factory

    fx = await _order_fixture(client)
    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_ORDER, entity_id=fx["order_id"], to_status=t.ORDER_PAID,
            actor_role=t.ROLE_ADMIN, actor_user_id=fx["buyer_id"], note="입금 확인",
        )
        await session.commit()

    async with async_session_factory() as session:
        order = await session.get(Order, fx["order_id"])
        sub = await session.get(SubOrder, fx["sub_order_id"])
        assert order.payment_status == "paid" and order.paid_at is not None
        assert sub.shipping_status == "preparing"

    events = await _events(fx["order_id"])
    assert [(e.entity_type, e.from_status, e.to_status) for e in events] == [
        ("order", "pending_payment", "paid"),
        ("sub_order", None, "preparing"),
    ]
    assert all(e.actor_role == "admin" and e.note == "입금 확인" for e in events)


@pytest.mark.asyncio
async def test_paid_cascade_skips_fully_canceled_sub_order(client, clean_products):
    """전 라인 canceled인 묶음은 preparing 연쇄에서 제외 — 판매자 유령 주문 방지."""
    from app.core.db import async_session_factory

    fx = await _order_fixture(client)
    async with async_session_factory() as session:
        await service.cancel_order_item(
            session, order_item_id=fx["item_id"], actor_role=t.ROLE_BUYER, actor_user_id=fx["buyer_id"],
            reason="단순 변심", responsibility="buyer",
        )
        await session.commit()
    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_ORDER, entity_id=fx["order_id"], to_status=t.ORDER_PAID,
            actor_role=t.ROLE_ADMIN, actor_user_id=None,
        )
        await session.commit()
        sub = await session.get(SubOrder, fx["sub_order_id"])
        assert sub.shipping_status is None  # 연쇄 제외


@pytest.mark.asyncio
async def test_shipping_requires_tracking_and_records_it(client, clean_products):
    """AC 1 가드 ②: 송장 없이 shipping 422 (admin 포함), 송장 기록은 transition()이 소유."""
    from app.core.db import async_session_factory

    fx = await _order_fixture(client)
    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_ORDER, entity_id=fx["order_id"], to_status=t.ORDER_PAID,
            actor_role=t.ROLE_ADMIN, actor_user_id=None,
        )
        await session.commit()

    async with async_session_factory() as session:
        for role in (t.ROLE_SELLER, t.ROLE_ADMIN):  # admin도 송장 가드 예외 없음
            with pytest.raises(AppError) as exc:
                await service.transition(
                    session, layer=t.LAYER_SUB_ORDER, entity_id=fx["sub_order_id"], to_status=t.SUB_SHIPPING,
                    actor_role=role, actor_user_id=None, carrier="", tracking_number="",
                )
            assert exc.value.code == "invalid_transition"
        await session.rollback()

    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_SUB_ORDER, entity_id=fx["sub_order_id"], to_status=t.SUB_SHIPPING,
            actor_role=t.ROLE_SELLER, actor_user_id=None, carrier="CJ대한통운", tracking_number="1234567890",
        )
        await session.commit()
        sub = await session.get(SubOrder, fx["sub_order_id"])
        assert sub.shipping_status == "shipping"
        assert sub.carrier == "CJ대한통운" and sub.tracking_number == "1234567890"

    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_SUB_ORDER, entity_id=fx["sub_order_id"], to_status=t.SUB_DELIVERED,
            actor_role=t.ROLE_SELLER, actor_user_id=None,
        )
        await session.commit()
        assert (await session.get(SubOrder, fx["sub_order_id"])).shipping_status == "delivered"


@pytest.mark.asyncio
async def test_cancel_restores_stock_exactly_once(client, clean_products):
    """AC 5: 취소 = 전이 + 재고 복원 + cancellations 한 트랜잭션. 재취소는 거부 → 복원 1회."""
    from app.core.db import async_session_factory

    fx = await _order_fixture(client, n_sellers_stock=5, qty=2)
    before = await _stock(fx["variant_id"])
    async with async_session_factory() as session:
        await service.cancel_order_item(
            session, order_item_id=fx["item_id"], actor_role=t.ROLE_BUYER, actor_user_id=fx["buyer_id"],
            reason="단순 변심", responsibility="buyer",
        )
        await session.commit()

    assert await _stock(fx["variant_id"]) == before + fx["qty"]  # 복원 +n

    async with async_session_factory() as session:
        row = await session.scalar(select(Cancellation).where(Cancellation.order_item_id == fx["item_id"]))
        assert row is not None and row.responsibility == "buyer" and row.refunded_at is None

    # 재취소: canceled→canceled 미정의 → 422, 재고 불변
    async with async_session_factory() as session:
        with pytest.raises(AppError) as exc:
            await service.cancel_order_item(
                session, order_item_id=fx["item_id"], actor_role=t.ROLE_ADMIN, actor_user_id=None,
                reason="중복", responsibility="admin",
            )
        assert exc.value.code == "invalid_transition"
        await session.rollback()
    assert await _stock(fx["variant_id"]) == before + fx["qty"]  # 정확히 1회


@pytest.mark.asyncio
async def test_undefined_transitions_rejected(client, clean_products):
    """AC 2: 미정의 전이는 422 invalid_transition."""
    from app.core.db import async_session_factory

    fx = await _order_fixture(client)
    cases = [
        (t.LAYER_SUB_ORDER, fx["sub_order_id"], t.SUB_SHIPPING),  # NULL→shipping 건너뛰기
        (t.LAYER_ORDER, fx["order_id"], t.SUB_DELIVERED),  # 층 불일치 값
    ]
    async with async_session_factory() as session:
        for layer, eid, to in cases:
            with pytest.raises(AppError) as exc:
                await service.transition(
                    session, layer=layer, entity_id=eid, to_status=to, actor_role=t.ROLE_ADMIN, actor_user_id=None
                )
            assert exc.value.code == "invalid_transition"
        await session.rollback()

    # confirmed는 값만 정의 — 전이표 미등록 (FR-20)
    assert not any(to == t.SUB_CONFIRMED for (_, _, to) in t.TRANSITIONS)


@pytest.mark.asyncio
async def test_role_not_allowed_403(client, clean_products):
    """AC 2: 정의된 전이라도 역할 불허는 403 forbidden."""
    from app.core.db import async_session_factory

    fx = await _order_fixture(client)
    async with async_session_factory() as session:
        for role in (t.ROLE_BUYER, t.ROLE_SELLER):  # 입금확인은 admin/system만
            with pytest.raises(AppError) as exc:
                await service.transition(
                    session, layer=t.LAYER_ORDER, entity_id=fx["order_id"], to_status=t.ORDER_PAID,
                    actor_role=role, actor_user_id=fx["buyer_id"],
                )
            assert exc.value.code == "forbidden"
        await session.rollback()


@pytest.mark.asyncio
async def test_buyer_cancel_blocked_after_preparing(client, clean_products):
    """AC 1 가드 ①: preparing 진입 후 buyer 라인 취소 거부, admin은 타이밍 가드 예외."""
    from app.core.db import async_session_factory

    fx = await _order_fixture(client)
    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_ORDER, entity_id=fx["order_id"], to_status=t.ORDER_PAID,
            actor_role=t.ROLE_ADMIN, actor_user_id=None,
        )
        await session.commit()

    async with async_session_factory() as session:
        with pytest.raises(AppError) as exc:
            await service.cancel_order_item(
                session, order_item_id=fx["item_id"], actor_role=t.ROLE_BUYER, actor_user_id=fx["buyer_id"],
                reason="변심", responsibility="buyer",
            )
        assert exc.value.code == "invalid_transition"
        await session.rollback()

    # admin은 preparing 이후에도 라인 취소 가능 (FR-29)
    async with async_session_factory() as session:
        await service.cancel_order_item(
            session, order_item_id=fx["item_id"], actor_role=t.ROLE_ADMIN, actor_user_id=None,
            reason="판매자 품절", responsibility="seller",
        )
        await session.commit()
        assert (await session.get(OrderItem, fx["item_id"])).status == "canceled"


@pytest.mark.asyncio
async def test_system_cancel_only_pending_payment(client, clean_products):
    """AC 1 가드 ③: system 라인 취소는 pending_payment 주문만 (4.5 자동취소 전제)."""
    from app.core.db import async_session_factory

    fx = await _order_fixture(client)
    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_ORDER, entity_id=fx["order_id"], to_status=t.ORDER_PAID,
            actor_role=t.ROLE_ADMIN, actor_user_id=None,
        )
        await session.commit()
    async with async_session_factory() as session:
        with pytest.raises(AppError) as exc:
            await service.cancel_order_item(
                session, order_item_id=fx["item_id"], actor_role=t.ROLE_SYSTEM, actor_user_id=None,
                reason="자동취소", responsibility="system",
            )
        assert exc.value.code == "invalid_transition"
        await session.rollback()


@pytest.mark.asyncio
async def test_system_events_have_null_actor(client, clean_products):
    """AC 4: system 전이는 actor_user_id NULL로 기록."""
    from app.core.db import async_session_factory

    fx = await _order_fixture(client)
    async with async_session_factory() as session:
        await service.cancel_order_item(
            session, order_item_id=fx["item_id"], actor_role=t.ROLE_SYSTEM, actor_user_id=None,
            reason="미입금 자동취소", responsibility="system",
        )
        await session.commit()
    events = await _events(fx["order_id"])
    assert len(events) == 1
    assert events[0].actor_role == "system" and events[0].actor_user_id is None


def test_no_status_writes_outside_engine():
    """AC 3: 상태 컬럼 대입/UPDATE가 전이 엔진 경로 밖에 없다 — AST 검사.

    검사 대상: payment_status·shipping_status 속성 대입(모든 파일), OrderItem류 .status 대입(app/orders 밖 포함
    핵심 상태 필드명), update(Order|SubOrder|OrderItem) 구문. 허용: orders/service.py·transitions.py·models.py(컬럼 정의).
    """
    app_dir = Path(__file__).resolve().parents[1] / "app"
    allowed = {app_dir / "orders" / "service.py", app_dir / "orders" / "transitions.py", app_dir / "orders" / "models.py"}
    order_models = {"Order", "SubOrder", "OrderItem"}
    violations = []
    for py in app_dir.rglob("*.py"):
        if py in allowed:
            continue
        tree = ast.parse(py.read_text(encoding="utf-8"))
        imports_order_models = any(
            isinstance(n, ast.ImportFrom) and n.module == "app.orders.models"
            and any(a.name in order_models for a in n.names)
            for n in ast.walk(tree)
        )
        for node in ast.walk(tree):
            # obj.payment_status = ... / obj.shipping_status = ... / (orders 모델 import 파일의) obj.status = ...
            if isinstance(node, ast.Assign):
                for tgt in node.targets:
                    if isinstance(tgt, ast.Attribute):
                        if tgt.attr in ("payment_status", "shipping_status"):
                            violations.append(f"{py}:{node.lineno} {tgt.attr} 대입")
                        if tgt.attr == "status" and imports_order_models:
                            violations.append(f"{py}:{node.lineno} .status 대입 (orders 모델 사용 파일)")
            # update(Order/SubOrder/OrderItem)
            if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "update":
                for arg in node.args:
                    if getattr(arg, "id", "") in order_models:
                        violations.append(f"{py}:{node.lineno} update({arg.id})")
    assert not violations, f"전이 함수 밖 상태 변경 발견: {violations}"
