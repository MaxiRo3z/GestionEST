"""Agrega unicidad (profesor, curso, fecha) a asistencias_profesores

Revision ID: 8347e885bfa2
Revises: 4b64c60b105a
Create Date: 2026-08-11 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8347e885bfa2'
down_revision: Union[str, Sequence[str], None] = '4b64c60b105a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Antes de crear la restricción, se eliminan duplicados preexistentes
    # (mismo profesor + curso + fecha) dejando el registro más reciente,
    # para que la migración no falle en una base que ya tenga cargas
    # repetidas por error.
    op.execute(
        """
        DELETE FROM asistencias_profesores a
        USING asistencias_profesores b
        WHERE a.profesor_id = b.profesor_id
          AND a.curso_id = b.curso_id
          AND a.fecha = b.fecha
          AND a.id < b.id
        """
    )
    op.create_unique_constraint(
        "uq_profesor_curso_fecha",
        "asistencias_profesores",
        ["profesor_id", "curso_id", "fecha"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_profesor_curso_fecha", "asistencias_profesores", type_="unique")
