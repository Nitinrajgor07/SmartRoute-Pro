"""Add approval_status and requested_role to users

Revision ID: 005_add_approval_status_and_requested_role_to_users
Revises: 004_add_customer_email_to_deliveries
Create Date: 2026-10-20 11:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '005_add_approval_status_and_requested_role_to_users'
down_revision = '004_add_customer_email_to_deliveries'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('approval_status', sa.String(length=20), nullable=False, server_default='approved'))
        batch_op.add_column(sa.Column('requested_role', sa.String(length=50), nullable=True))
        batch_op.create_index(batch_op.f('ix_users_approval_status'), ['approval_status'], unique=False)

def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_approval_status'))
        batch_op.drop_column('requested_role')
        batch_op.drop_column('approval_status')
