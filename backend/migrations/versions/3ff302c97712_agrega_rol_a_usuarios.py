"""Agrega columna rol a usuarios (admin vs cliente)

Revision ID: 3ff302c97712
Revises: c1a9f6e2b7d4
Create Date: 2026-08-11 19:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ff302c97712'
down_revision: Union[str, Sequence[str], None] = 'c1a9f6e2b7d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default="admin" hace que el/los usuarios ya existentes (el
    # admin único que había hasta ahora) queden con rol "admin" -- exactamente
    # lo que eran antes de que existiera este campo.
    op.add_column(
        "usuarios",
        sa.Column("rol", sa.String(length=20), nullable=False, server_default="admin"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("usuarios", "rol")
