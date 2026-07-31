"""agreements and user_agreements

Revision ID: d5a1c7e93b02
Revises: c3f1a2b9e4d7
Create Date: 2026-07-31 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5a1c7e93b02'
down_revision: Union[str, Sequence[str], None] = 'c3f1a2b9e4d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """약관 버전·동의 이력 (오픈 게이트 P0, AD-9 — Slur 승인 2026-07-31).

    문안은 코드가 소유하고 여기에는 버전 메타데이터와 동의 사실만 남긴다.
    동의 이력은 분쟁 시 입증 자료라 users·agreements 모두 RESTRICT로 묶어 지워지지 않게 한다.
    """
    op.create_table('agreements',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('type', sa.String(length=20), nullable=False),
    sa.Column('version', sa.String(length=20), nullable=False),
    sa.Column('effective_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('content_hash', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("type IN ('terms', 'privacy')", name='ck_agreements_type'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('type', 'version', name='uq_agreements_type_version'),
    )
    op.create_table('user_agreements',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('agreement_id', sa.UUID(), nullable=False),
    sa.Column('agreed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['agreement_id'], ['agreements.id'], ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'agreement_id', name='uq_user_agreements_user_agreement'),
    )
    op.create_index(op.f('ix_user_agreements_user_id'), 'user_agreements', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_agreements_agreement_id'), 'user_agreements', ['agreement_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_agreements_agreement_id'), table_name='user_agreements')
    op.drop_index(op.f('ix_user_agreements_user_id'), table_name='user_agreements')
    op.drop_table('user_agreements')
    op.drop_table('agreements')
