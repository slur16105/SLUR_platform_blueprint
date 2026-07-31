"""shipments (분할배송)

Revision ID: a72e5f19d834
Revises: f6b8e04c92a5
Create Date: 2026-08-01 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a72e5f19d834'
down_revision: Union[str, Sequence[str], None] = 'f6b8e04c92a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """분할배송 (오픈 게이트 P1, AD-9 — Slur 승인 2026-07-31).

    sub_orders에 carrier/tracking_number가 1쌍뿐이라 2박스로 나눠 보내면 송장을 덮어써야 했다.
    기존 1쌍 컬럼은 **대표 송장**으로 남긴다 — 화면·API가 이미 쓰고 있고, 여러 건이면 최신이 대표다.

    기존 배송 건은 shipments로 소급 생성한다(송장이 있는 묶음만).
    """
    op.create_table('shipments',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('sub_order_id', sa.UUID(), nullable=False),
    sa.Column('carrier', sa.String(length=50), nullable=False),
    sa.Column('tracking_number', sa.String(length=50), nullable=False),
    sa.Column('note', sa.String(length=200), nullable=False),
    sa.Column('shipped_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['sub_order_id'], ['sub_orders.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_shipments_sub_order_id'), 'shipments', ['sub_order_id'], unique=False)

    op.execute("""
        INSERT INTO shipments (id, sub_order_id, carrier, tracking_number, note, shipped_at, created_at)
        SELECT gen_random_uuid(), s.id, s.carrier, s.tracking_number, '', s.updated_at, s.updated_at
          FROM sub_orders s
         WHERE s.tracking_number IS NOT NULL AND s.tracking_number <> ''
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_shipments_sub_order_id'), table_name='shipments')
    op.drop_table('shipments')
