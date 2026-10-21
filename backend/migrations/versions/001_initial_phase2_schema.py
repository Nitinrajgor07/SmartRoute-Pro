"""Initial schema for Users, Locations, Roads, Deliveries, RouteRuns

Revision ID: 001_initial_phase2_schema
Revises: 
Create Date: 2026-10-16 20:55:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_initial_phase2_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # 1. Users Table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='dispatcher'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. Locations Table
    op.create_table(
        'locations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('address', sa.String(length=255), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_locations_name'), 'locations', ['name'], unique=False)

    # 3. Roads Table
    op.create_table(
        'roads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('source_location_id', sa.Integer(), nullable=False),
        sa.Column('destination_location_id', sa.Integer(), nullable=False),
        sa.Column('distance_km', sa.Float(), nullable=False),
        sa.Column('estimated_duration_minutes', sa.Float(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.ForeignKeyConstraint(['destination_location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_location_id', 'destination_location_id', name='uq_source_destination')
    )
    op.create_index(op.f('ix_roads_destination_location_id'), 'roads', ['destination_location_id'], unique=False)
    op.create_index(op.f('ix_roads_source_location_id'), 'roads', ['source_location_id'], unique=False)

    # 4. Deliveries Table
    op.create_table(
        'deliveries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tracking_number', sa.String(length=50), nullable=False),
        sa.Column('customer_name', sa.String(length=150), nullable=False),
        sa.Column('pickup_location_id', sa.Integer(), nullable=False),
        sa.Column('destination_location_id', sa.Integer(), nullable=False),
        sa.Column('delivery_date', sa.Date(), nullable=False),
        sa.Column('priority', sa.String(length=20), nullable=False, server_default='Standard'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='Pending'),
        sa.Column('distance_km', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('package_weight_kg', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('estimated_delivery_time', sa.String(length=50), nullable=True),
        sa.Column('assigned_driver', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['destination_location_id'], ['locations.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['pickup_location_id'], ['locations.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_deliveries_customer_name'), 'deliveries', ['customer_name'], unique=False)
    op.create_index(op.f('ix_deliveries_destination_location_id'), 'deliveries', ['destination_location_id'], unique=False)
    op.create_index(op.f('ix_deliveries_pickup_location_id'), 'deliveries', ['pickup_location_id'], unique=False)
    op.create_index(op.f('ix_deliveries_tracking_number'), 'deliveries', ['tracking_number'], unique=True)

    # 5. Route Runs Table
    op.create_table(
        'route_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('source_location_id', sa.Integer(), nullable=True),
        sa.Column('destination_location_id', sa.Integer(), nullable=True),
        sa.Column('algorithm', sa.String(length=50), nullable=False),
        sa.Column('total_distance_km', sa.Float(), nullable=False),
        sa.Column('path_json', sa.Text(), nullable=False),
        sa.Column('execution_time_ms', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['destination_location_id'], ['locations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['source_location_id'], ['locations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('route_runs')
    op.drop_index(op.f('ix_deliveries_tracking_number'), table_name='deliveries')
    op.drop_index(op.f('ix_deliveries_pickup_location_id'), table_name='deliveries')
    op.drop_index(op.f('ix_deliveries_destination_location_id'), table_name='deliveries')
    op.drop_index(op.f('ix_deliveries_customer_name'), table_name='deliveries')
    op.drop_table('deliveries')
    op.drop_index(op.f('ix_roads_source_location_id'), table_name='roads')
    op.drop_index(op.f('ix_roads_destination_location_id'), table_name='roads')
    op.drop_table('roads')
    op.drop_index(op.f('ix_locations_name'), table_name='locations')
    op.drop_table('locations')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
