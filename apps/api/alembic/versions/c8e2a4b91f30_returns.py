"""returns, return_items, sub_orders.delivered_at

Revision ID: c8e2a4b91f30
Revises: b3f9c1d47e25
Create Date: 2026-07-31 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8e2a4b91f30'
down_revision: Union[str, Sequence[str], None] = 'b3f9c1d47e25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """반품·교환 (오픈 게이트 P0 · 법정 의무, AD-9 — Slur 승인 2026-07-31).

    cancellations는 배송 '전' 취소 전용이라, 전자상거래법 제17조 청약철회(배송 완료 후 7일)를
    담을 자리가 없었다. 최소형(요청→승인/거부→완료 3상태)으로 만든다 — 반송비 정산은
    PG·정산 설계와 한 묶음이라 지금 컬럼을 굳히지 않는다.

    `sub_orders.delivered_at`은 기한 판정의 기준점이다. 기존 배송완료 건은 order_events의
    delivered 전이 시각으로 소급 채운다(기록이 없으면 NULL — 서비스가 기한 검사를 건너뛴다).
    """
    op.add_column('sub_orders', sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True))
    op.execute("""
        UPDATE sub_orders s
           SET delivered_at = e.created_at
          FROM (
            SELECT entity_id, MAX(created_at) AS created_at
              FROM order_events
             WHERE entity_type = 'sub_order' AND to_status = 'delivered'
             GROUP BY entity_id
          ) e
         WHERE s.id = e.entity_id AND s.shipping_status = 'delivered'
    """)

    op.create_table('returns',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('sub_order_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('reason', sa.String(length=30), nullable=False),
    sa.Column('detail', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('admin_note', sa.Text(), nullable=False),
    sa.Column('refund_amount', sa.Integer(), nullable=False),
    sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("kind IN ('return', 'exchange')", name='ck_returns_kind'),
    sa.CheckConstraint("status IN ('requested', 'approved', 'rejected', 'completed')", name='ck_returns_status'),
    sa.CheckConstraint("reason IN ('change_of_mind', 'defect', 'wrong_delivery', 'etc')", name='ck_returns_reason'),
    sa.CheckConstraint('refund_amount >= 0', name='ck_returns_refund_amount'),
    sa.ForeignKeyConstraint(['sub_order_id'], ['sub_orders.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_returns_sub_order_id'), 'returns', ['sub_order_id'], unique=False)
    op.create_index(op.f('ix_returns_user_id'), 'returns', ['user_id'], unique=False)
    op.create_index(op.f('ix_returns_status'), 'returns', ['status'], unique=False)

    op.create_table('return_items',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('return_id', sa.UUID(), nullable=False),
    sa.Column('order_item_id', sa.UUID(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('quantity >= 1', name='ck_return_items_quantity'),
    sa.ForeignKeyConstraint(['order_item_id'], ['order_items.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['return_id'], ['returns.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('return_id', 'order_item_id', name='uq_return_items_return_order_item'),
    )
    op.create_index(op.f('ix_return_items_return_id'), 'return_items', ['return_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_return_items_return_id'), table_name='return_items')
    op.drop_table('return_items')
    for idx in ('ix_returns_status', 'ix_returns_user_id', 'ix_returns_sub_order_id'):
        op.drop_index(op.f(idx), table_name='returns')
    op.drop_table('returns')
    op.drop_column('sub_orders', 'delivered_at')
