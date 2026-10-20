"""Add Authentication fields and TokenBlocklist model

Revision ID: 003_add_auth_fields_and_token_blocklist
Revises: 002_add_sda_clustering_models
Create Date: 2026-10-16 22:25:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003_add_auth_fields_and_token_blocklist'
down_revision = '002_add_sda_clustering_models'
branch_labels = None
depends_on = None

def upgrade():
    # 1. Add missing fields to users table safely
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))

    # 2. Token Blocklist Table for Server-Side Logout Revocation
    op.create_table(
        'token_blocklist',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('jti', sa.String(length=36), nullable=False),
        sa.Column('token_type', sa.String(length=10), nullable=False, server_default='access'),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_token_blocklist_jti'), 'token_blocklist', ['jti'], unique=False)

def downgrade():
    op.drop_index(op.f('ix_token_blocklist_jti'), table_name='token_blocklist')
    op.drop_table('token_blocklist')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('is_active')
