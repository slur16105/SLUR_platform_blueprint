"""free shipping threshold, payout account, variants.sku, inventory_transactions

Revision ID: f6b8e04c92a5
Revises: e5c9d13a7f42
Create Date: 2026-08-01 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6b8e04c92a5'
down_revision: Union[str, Sequence[str], None] = 'e5c9d13a7f42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """표준 커머스 잔여 항목 (오픈 게이트 P1, AD-9 — Slur 승인 2026-07-31).

    - sellers.free_shipping_threshold: 조건부 무료배송("5만원 이상 무료"). 국내 사실상 표준인데
      설정할 자리가 없었다. 0 = 미사용. **기본 배송비만 면제하고 도서산간 추가비는 면제하지 않는다**
      (실제 추가 운임이 나가는 비용이라 면제하면 판매자가 손해).
    - sellers.payout_*: 정산 지급 계좌. 중개 모델에서 대금을 받아 넘기려면 필수인데 자리조차 없었다.
      실제 지급 실행은 PG·정산 도입 시점.
    - variants.sku: 판매자 관리코드. 택배사 연동·정산 대조·재고 실사의 공통 키.
      판매자 안에서만 유일하면 되므로 전역 UNIQUE는 걸지 않는다.
    - inventory_transactions: 재고 증감 이력. stock 스칼라만 있어 "왜 재고가 3인가"에 답할 수
      없었다(AD-4는 정확성은 보장하지만 감사 가능성은 보장하지 않는다).
      **원장은 사후 추적용이고 재고의 진실은 여전히 variants.stock이다.**
    """
    op.add_column('sellers', sa.Column('free_shipping_threshold', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('sellers', sa.Column('payout_bank', sa.String(length=50), nullable=False, server_default=''))
    op.add_column('sellers', sa.Column('payout_account_no', sa.String(length=50), nullable=False, server_default=''))
    op.add_column('sellers', sa.Column('payout_holder', sa.String(length=50), nullable=False, server_default=''))
    op.add_column('variants', sa.Column('sku', sa.String(length=50), nullable=False, server_default=''))

    op.create_table('inventory_transactions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('variant_id', sa.UUID(), nullable=False),
    sa.Column('delta', sa.Integer(), nullable=False),
    sa.Column('stock_after', sa.Integer(), nullable=False),
    sa.Column('reason', sa.String(length=20), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=True),
    sa.Column('actor_user_id', sa.UUID(), nullable=True),
    sa.Column('note', sa.String(length=200), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("reason IN ('order', 'cancel', 'return', 'adjust')", name='ck_inventory_tx_reason'),
    sa.CheckConstraint('delta <> 0', name='ck_inventory_tx_delta'),
    sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['variant_id'], ['variants.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_inventory_transactions_variant_id'), 'inventory_transactions', ['variant_id'], unique=False)
    op.create_index(op.f('ix_inventory_transactions_order_id'), 'inventory_transactions', ['order_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_inventory_transactions_order_id'), table_name='inventory_transactions')
    op.drop_index(op.f('ix_inventory_transactions_variant_id'), table_name='inventory_transactions')
    op.drop_table('inventory_transactions')
    op.drop_column('variants', 'sku')
    for col in ('payout_holder', 'payout_account_no', 'payout_bank', 'free_shipping_threshold'):
        op.drop_column('sellers', col)
