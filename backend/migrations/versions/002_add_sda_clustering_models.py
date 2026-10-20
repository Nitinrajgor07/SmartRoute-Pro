"""Add SDA ClusterRun and ClusterAssignment models

Revision ID: 002_add_sda_clustering_models
Revises: 001_initial_phase2_schema
Create Date: 2026-10-16 21:28:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_sda_clustering_models'
down_revision = '001_initial_phase2_schema'
branch_labels = None
depends_on = None

def upgrade():
    # 1. Cluster Runs Table
    op.create_table(
        'cluster_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('k', sa.Integer(), nullable=False),
        sa.Column('max_iterations', sa.Integer(), nullable=False, server_default='300'),
        sa.Column('random_state', sa.Integer(), nullable=False, server_default='42'),
        sa.Column('inertia', sa.Float(), nullable=False),
        sa.Column('silhouette_score', sa.Float(), nullable=True),
        sa.Column('iterations_run', sa.Integer(), nullable=False),
        sa.Column('total_locations', sa.Integer(), nullable=False),
        sa.Column('centroids_json', sa.Text(), nullable=False),
        sa.Column('execution_time_ms', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Cluster Assignments Table
    op.create_table(
        'cluster_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cluster_run_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=False),
        sa.Column('cluster_id', sa.Integer(), nullable=False),
        sa.Column('distance_to_centroid_km', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['cluster_run_id'], ['cluster_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cluster_assignments_cluster_run_id'), 'cluster_assignments', ['cluster_run_id'], unique=False)
    op.create_index(op.f('ix_cluster_assignments_location_id'), 'cluster_assignments', ['location_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_cluster_assignments_location_id'), table_name='cluster_assignments')
    op.drop_index(op.f('ix_cluster_assignments_cluster_run_id'), table_name='cluster_assignments')
    op.drop_table('cluster_assignments')
    op.drop_table('cluster_runs')
