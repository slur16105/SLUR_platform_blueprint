"""orders.order_no (human-readable, unique)

Revision ID: b3f9c1d47e25
Revises: a91d5e2f70c4
Create Date: 2026-07-31 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3f9c1d47e25'
down_revision: Union[str, Sequence[str], None] = 'a91d5e2f70c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """사람이 읽는 주문번호를 컬럼으로 승격 (오픈 게이트 P0, AD-9 — Slur 승인 2026-07-31).

    이전에는 UUID 끝 8자를 런타임에 잘라 표시했다 — UNIQUE 보장이 없어 충돌 시 CS·입금 대조가
    끊긴다. PG는 가맹점 주문번호를 고유·불변·재사용 금지로 요구하므로 **연동 전에** 못박는다.

    **표시 형식은 그대로 둔다**(UUID 끝 8자 대문자). 기존 주문은 지금 화면에 보이는 값을 그대로
    채워 넣어 안내 메일·CS 기록과의 대조가 끊기지 않게 한다.
    끝 8자가 겹치는 기존 주문이 있으면 뒤에 -2, -3을 붙여 유일하게 만든다(발생 확률은 낮지만
    UNIQUE 제약을 걸기 전에 반드시 해소해야 한다).
    """
    op.add_column('orders', sa.Column('order_no', sa.String(length=20), nullable=True))

    conn = op.get_bind()
    # 1) 현재 표시값 그대로 채운다
    conn.execute(sa.text(
        "UPDATE orders SET order_no = UPPER(RIGHT(REPLACE(id::text, '-', ''), 8))"
    ))
    # 2) 겹치는 값은 생성 순서대로 접미사를 붙여 해소
    conn.execute(sa.text("""
        WITH dup AS (
            SELECT id, order_no,
                   ROW_NUMBER() OVER (PARTITION BY order_no ORDER BY created_at, id) AS rn
              FROM orders
        )
        UPDATE orders o
           SET order_no = dup.order_no || '-' || dup.rn
          FROM dup
         WHERE o.id = dup.id AND dup.rn > 1
    """))

    op.alter_column('orders', 'order_no', nullable=False)
    op.create_unique_constraint('uq_orders_order_no', 'orders', ['order_no'])


def downgrade() -> None:
    op.drop_constraint('uq_orders_order_no', 'orders', type_='unique')
    op.drop_column('orders', 'order_no')
