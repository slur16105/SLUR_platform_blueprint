"""payments, refunds (거래 원장)

Revision ID: e5c9d13a7f42
Revises: d4a7b62c8e11
Create Date: 2026-08-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5c9d13a7f42'
down_revision: Union[str, Sequence[str], None] = 'd4a7b62c8e11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """결제·환불 거래 원장 (오픈 게이트 P0 — PG 연동 선결, AD-9 승인 2026-07-31).

    결제 정보가 orders.payment_status + paid_at 두 컬럼뿐이라 결제 시도 N건·PG 승인번호·
    결제수단·웹훅 멱등키를 담을 자리가 없었고, **환불 금액 컬럼은 아예 없었다.**

    지금은 무통장뿐이라 method='bank_transfer' 한 갈래만 쓰이지만, PG를 붙일 때
    **스키마 변경 없이 행만 늘어나게** 하려고 지금 만든다. 연동 시 채워지는 것은
    provider·provider_tid·raw_response뿐이다.

    기존 결제 완료 주문은 원장으로 소급 생성한다 — 안 하면 "받은 돈" 집계가 도입 시점부터
    끊긴다. 금액은 취소되지 않은 품목 + 살아있는 묶음의 배송비(현재 화면 표시 규칙과 동일).
    """
    op.create_table('payments',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=False),
    sa.Column('method', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('provider', sa.String(length=30), nullable=False),
    sa.Column('provider_tid', sa.String(length=100), nullable=False),
    sa.Column('idempotency_key', sa.String(length=100), nullable=True),
    sa.Column('raw_response', sa.Text(), nullable=False),
    sa.Column('failure_reason', sa.String(length=200), nullable=False),
    sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("method IN ('bank_transfer', 'card', 'virtual_account', 'easy_pay')", name='ck_payments_method'),
    sa.CheckConstraint("status IN ('pending', 'paid', 'failed', 'canceled')", name='ck_payments_status'),
    sa.CheckConstraint('amount >= 0', name='ck_payments_amount'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('idempotency_key', name='uq_payments_idempotency_key'),
    )
    op.create_index(op.f('ix_payments_order_id'), 'payments', ['order_id'], unique=False)
    op.create_index(op.f('ix_payments_status'), 'payments', ['status'], unique=False)

    op.create_table('refunds',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('payment_id', sa.UUID(), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('reason', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('return_id', sa.UUID(), nullable=True),
    sa.Column('provider_tid', sa.String(length=100), nullable=False),
    sa.Column('idempotency_key', sa.String(length=100), nullable=True),
    sa.Column('note', sa.Text(), nullable=False),
    sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('requested', 'done', 'failed')", name='ck_refunds_status'),
    sa.CheckConstraint("reason IN ('order_cancel', 'item_cancel', 'return', 'etc')", name='ck_refunds_reason'),
    sa.CheckConstraint('amount >= 0', name='ck_refunds_amount'),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['return_id'], ['returns.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('idempotency_key', name='uq_refunds_idempotency_key'),
    )
    op.create_index(op.f('ix_refunds_payment_id'), 'refunds', ['payment_id'], unique=False)
    op.create_index(op.f('ix_refunds_status'), 'refunds', ['status'], unique=False)

    # 기존 결제 완료 주문을 원장으로 소급 — 금액 규칙은 화면 표시와 동일(취소분 제외)
    op.execute("""
        INSERT INTO payments (id, order_id, method, status, amount, provider, provider_tid,
                              idempotency_key, raw_response, failure_reason, paid_at, created_at, updated_at)
        SELECT gen_random_uuid(), o.id, 'bank_transfer', 'paid',
               COALESCE(items.total, 0) + COALESCE(ship.total, 0),
               '', '', 'bank:' || o.id::text, '', '',
               o.paid_at, o.paid_at, o.paid_at
          FROM orders o
          LEFT JOIN (
            SELECT so.order_id, SUM((oi.unit_price + oi.extra_price) * oi.quantity) AS total
              FROM order_items oi JOIN sub_orders so ON so.id = oi.sub_order_id
             WHERE oi.status = 'ordered'
             GROUP BY so.order_id
          ) items ON items.order_id = o.id
          LEFT JOIN (
            SELECT so.order_id, SUM(so.shipping_fee + so.remote_extra_fee) AS total
              FROM sub_orders so
             WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.sub_order_id = so.id AND oi.status = 'ordered')
             GROUP BY so.order_id
          ) ship ON ship.order_id = o.id
         WHERE o.payment_status = 'paid'
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_refunds_status'), table_name='refunds')
    op.drop_index(op.f('ix_refunds_payment_id'), table_name='refunds')
    op.drop_table('refunds')
    op.drop_index(op.f('ix_payments_status'), table_name='payments')
    op.drop_index(op.f('ix_payments_order_id'), table_name='payments')
    op.drop_table('payments')
