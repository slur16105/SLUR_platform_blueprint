"""inquiries and inquiry_replies

Revision ID: e2b4f81c66a9
Revises: d5a1c7e93b02
Create Date: 2026-07-31 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e2b4f81c66a9'
down_revision: Union[str, Sequence[str], None] = 'd5a1c7e93b02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """1:1 문의·운영자 답변 (오픈 게이트 P0, AD-9 — Slur 승인 2026-07-31).

    통신판매중개자의 소비자 불만·분쟁 처리 창구. 작성자는 RESTRICT(분쟁 기록),
    주문 연결은 SET NULL(주문이 지워져도 처리 이력은 남는다).
    """
    op.create_table('inquiries',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('order_id', sa.UUID(), nullable=True),
    sa.Column('category', sa.String(length=20), nullable=False),
    sa.Column('title', sa.String(length=100), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('answered_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("category IN ('order', 'product', 'account', 'etc')", name='ck_inquiries_category'),
    sa.CheckConstraint("status IN ('open', 'answered', 'closed')", name='ck_inquiries_status'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_inquiries_user_id'), 'inquiries', ['user_id'], unique=False)
    op.create_index(op.f('ix_inquiries_order_id'), 'inquiries', ['order_id'], unique=False)
    op.create_index(op.f('ix_inquiries_status'), 'inquiries', ['status'], unique=False)
    op.create_table('inquiry_replies',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('inquiry_id', sa.UUID(), nullable=False),
    sa.Column('admin_user_id', sa.UUID(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['admin_user_id'], ['users.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['inquiry_id'], ['inquiries.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_inquiry_replies_inquiry_id'), 'inquiry_replies', ['inquiry_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_inquiry_replies_inquiry_id'), table_name='inquiry_replies')
    op.drop_table('inquiry_replies')
    op.drop_index(op.f('ix_inquiries_status'), table_name='inquiries')
    op.drop_index(op.f('ix_inquiries_order_id'), table_name='inquiries')
    op.drop_index(op.f('ix_inquiries_user_id'), table_name='inquiries')
    op.drop_table('inquiries')
