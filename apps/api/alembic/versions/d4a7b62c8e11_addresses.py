"""addresses (배송지 주소록)

Revision ID: d4a7b62c8e11
Revises: c8e2a4b91f30
Create Date: 2026-08-01 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4a7b62c8e11'
down_revision: Union[str, Sequence[str], None] = 'c8e2a4b91f30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """배송지 주소록 (오픈 게이트 P1, AD-9 — Slur 승인 2026-07-31).

    배송지가 orders 스냅샷으로만 존재해 재주문마다 전부 다시 입력해야 했다.
    주소록은 **입력 편의 장치**이고 주문의 진실은 여전히 스냅샷이다(AD-7) —
    주소록을 고쳐도 기존 주문의 배송지는 바뀌지 않는다.

    기본 배송지 1개 제약은 부분 유니크 인덱스가 DB에서 강제한다(앱 로직만으로는 동시 요청에서
    둘 다 기본이 될 수 있다).
    """
    op.create_table('addresses',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('label', sa.String(length=30), nullable=False),
    sa.Column('recipient_name', sa.String(length=50), nullable=False),
    sa.Column('recipient_phone', sa.String(length=20), nullable=False),
    sa.Column('postal_code', sa.String(length=5), nullable=False),
    sa.Column('address1', sa.String(length=255), nullable=False),
    sa.Column('address2', sa.String(length=255), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_addresses_user_id', 'addresses', ['user_id'], unique=False)
    op.create_index(
        'uq_addresses_default_per_user', 'addresses', ['user_id'],
        unique=True, postgresql_where=sa.text('is_default'),
    )


def downgrade() -> None:
    op.drop_index('uq_addresses_default_per_user', table_name='addresses')
    op.drop_index('ix_addresses_user_id', table_name='addresses')
    op.drop_table('addresses')
