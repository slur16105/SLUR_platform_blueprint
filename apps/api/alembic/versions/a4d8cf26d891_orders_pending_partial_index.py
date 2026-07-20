"""orders pending partial index

Revision ID: a4d8cf26d891
Revises: 7ef2fee3ff3e
Create Date: 2026-07-20 14:05:50.481880

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4d8cf26d891'
down_revision: Union[str, Sequence[str], None] = '7ef2fee3ff3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """입금대기 partial index — 5.2 목록·4.5 배치 공용 조회 (Slur 승인 2026-07-20, AD-9)."""
    op.create_index(
        "ix_orders_pending", "orders", ["deposit_due_at"], unique=False,
        postgresql_where=sa.text("payment_status = 'pending_payment'"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_orders_pending", table_name="orders")
