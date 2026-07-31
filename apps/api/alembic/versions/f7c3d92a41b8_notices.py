"""notices

Revision ID: f7c3d92a41b8
Revises: e2b4f81c66a9
Create Date: 2026-07-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7c3d92a41b8'
down_revision: Union[str, Sequence[str], None] = 'e2b4f81c66a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """공지사항 (오픈 게이트 P0, AD-9 — Slur 승인 2026-07-31).

    약관 변경 고지(시행 7일 전, 불리한 변경은 30일 전)를 이행할 지면.
    published_at NULL = 임시저장, 미래 시각 = 예약 게시 — 공개 조회는 now() 이하만 본다.
    """
    op.create_table('notices',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('is_pinned', sa.Boolean(), nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notices_published_at'), 'notices', ['published_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notices_published_at'), table_name='notices')
    op.drop_table('notices')
