"""deposit account split into bank / number / holder

Revision ID: a91d5e2f70c4
Revises: f7c3d92a41b8
Create Date: 2026-07-31 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a91d5e2f70c4'
down_revision: Union[str, Sequence[str], None] = 'f7c3d92a41b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """입금 계좌를 은행·계좌번호·예금주 3필드로 분리 (오픈 게이트).

    구매자 입금 안내가 '예금주' 줄을 따로 보여줘야 하는데 값이 문자열 하나뿐이라 만들 수 없었다.
    스키마 변경이 아니라 settings 행 추가다(AD-13 key-value). 기존 `deposit_account`는
    조립 표시용으로 남겨 옛 경로가 읽어도 깨지지 않게 한다.

    기존 값이 `은행/계좌번호/예금주` 형태면 분해해 넣고, 아니면 빈 값으로 둔다
    (운영자가 설정 화면에서 채운다 — 실계좌 등록은 오픈 게이트 항목이다).
    """
    conn = op.get_bind()
    current = conn.execute(sa.text("SELECT value FROM settings WHERE key = 'deposit_account'")).scalar()
    bank = number = holder = ""
    if current and "미설정" not in current:
        parts = [p.strip() for p in current.split("/")]
        if len(parts) == 3:
            bank, number, holder = parts

    for key, value, desc in (
        ("deposit_bank", bank, "무통장입금 은행"),
        ("deposit_account_no", number, "무통장입금 계좌번호"),
        ("deposit_holder", holder, "무통장입금 예금주"),
    ):
        conn.execute(
            sa.text(
                "INSERT INTO settings (key, value, description) VALUES (:k, :v, :d) "
                "ON CONFLICT (key) DO NOTHING"
            ),
            {"k": key, "v": value, "d": desc},
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM settings WHERE key IN ('deposit_bank', 'deposit_account_no', 'deposit_holder')"))
