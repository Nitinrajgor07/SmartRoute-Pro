"""Add customer_email to deliveries

Revision ID: 004_add_customer_email_to_deliveries
Revises: 003_add_auth_fields_and_token_blocklist
Create Date: 2026-10-19 12:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004_add_customer_email_to_deliveries'
down_revision = '003_add_auth_fields_and_token_blocklist'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('customer_email', sa.String(length=120), nullable=True))
        batch_op.create_index(batch_op.f('ix_deliveries_customer_email'), ['customer_email'], unique=False)

def downgrade():
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_deliveries_customer_email'))
        batch_op.drop_column('customer_email')
