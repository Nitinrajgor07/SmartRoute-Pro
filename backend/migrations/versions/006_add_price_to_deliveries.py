"""Add nullable saved parcel price to deliveries.

Revision ID: 006_add_price_to_deliveries
Revises: 005_add_approval_status_and_requested_role_to_users
"""
from alembic import op
import sqlalchemy as sa


revision = "006_add_price_to_deliveries"
down_revision = "005_add_approval_status_and_requested_role_to_users"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("deliveries", schema=None) as batch_op:
        batch_op.add_column(sa.Column("price", sa.Float(), nullable=True))


def downgrade():
    with op.batch_alter_table("deliveries", schema=None) as batch_op:
        batch_op.drop_column("price")
