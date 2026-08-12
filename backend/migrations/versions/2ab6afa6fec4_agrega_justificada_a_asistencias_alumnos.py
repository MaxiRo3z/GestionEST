"""agrega_justificada_a_asistencias_alumnos

Revision ID: 2ab6afa6fec4
Revises: 3ff302c97712
Create Date: 2026-08-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2ab6afa6fec4'
down_revision: Union[str, Sequence[str], None] = '3ff302c97712'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'asistencias_alumnos',
        sa.Column('justificada', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column('asistencias_alumnos', 'justificada', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('asistencias_alumnos', 'justificada')
