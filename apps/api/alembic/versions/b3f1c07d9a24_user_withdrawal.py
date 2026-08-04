"""회원 탈퇴 (users.deleted_at)

Revision ID: b3f1c07d9a24
Revises: a72e5f19d834
Create Date: 2026-08-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3f1c07d9a24'
down_revision: Union[str, Sequence[str], None] = 'a72e5f19d834'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """회원 탈퇴 (오픈 게이트, AD-9 — Slur 승인 2026-08-04).

    개인정보처리방침이 "회원 탈퇴 시 지체 없이 파기"를 이미 공지하고 있는데 탈퇴 수단이 없었다.

    **행을 지우지 않고 개인정보 칸만 비운다.** orders·user_agreements·inquiries·returns의
    user_id가 전부 ondelete=RESTRICT라 주문 이력이 있는 회원은 DB가 DELETE를 거부한다 —
    "거래·법정 기록은 보존한다"는 판단이 이미 스키마에 새겨져 있고, 익명화가 그 구조의 귀결이다.

    deleted_at은 탈퇴 시각이자 탈퇴 여부 표시다. NULL이면 정상 회원.
    개인정보 파기 사실의 기록이기도 하므로 값을 되돌리는 경로는 만들지 않는다(복구 없음).

    partial index: 관리자 회원 목록이 "정상 회원만" 세는 질의를 반복한다.
    """
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        'ix_users_active', 'users', ['created_at'],
        unique=False, postgresql_where=sa.text('deleted_at IS NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_users_active', table_name='users', postgresql_where=sa.text('deleted_at IS NULL'))
    op.drop_column('users', 'deleted_at')
