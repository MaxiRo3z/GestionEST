"""Crea tabla usuarios (autenticación)

Revision ID: c1a9f6e2b7d4
Revises: 8347e885bfa2
Create Date: 2026-08-11 18:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a9f6e2b7d4'
down_revision: Union[str, Sequence[str], None] = '8347e885bfa2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=200), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.UniqueConstraint("username", name="uq_usuarios_username"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("usuarios")
