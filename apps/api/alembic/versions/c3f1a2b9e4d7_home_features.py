"""home features and home feature items

Revision ID: c3f1a2b9e4d7
Revises: a4d8cf26d891
Create Date: 2026-07-27 20:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f1a2b9e4d7'
down_revision: Union[str, Sequence[str], None] = 'a4d8cf26d891'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """홈 편성 지면·품목 (시안 C · Epic 9, AD-9 — Slur 승인 2026-07-27)."""
    op.create_table('home_features',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('issue_no', sa.String(length=20), nullable=True),
    sa.Column('issue_label', sa.String(length=20), nullable=True),
    sa.Column('title', sa.String(length=120), nullable=False),
    sa.Column('lead_text', sa.Text(), nullable=True),
    sa.Column('image_path', sa.String(length=300), nullable=True),
    sa.Column('layout', sa.String(length=20), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("kind IN ('hero', 'slot')", name='ck_home_features_kind'),
    sa.CheckConstraint("layout IN ('feature', 'strip')", name='ck_home_features_layout'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('home_feature_items',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('feature_id', sa.UUID(), nullable=False),
    sa.Column('product_id', sa.UUID(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['feature_id'], ['home_features.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('feature_id', 'product_id')
    )
    op.create_index(op.f('ix_home_feature_items_feature_id'), 'home_feature_items', ['feature_id'], unique=False)
    op.create_index(op.f('ix_home_feature_items_product_id'), 'home_feature_items', ['product_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_home_feature_items_product_id'), table_name='home_feature_items')
    op.drop_index(op.f('ix_home_feature_items_feature_id'), table_name='home_feature_items')
    op.drop_table('home_feature_items')
    op.drop_table('home_features')
