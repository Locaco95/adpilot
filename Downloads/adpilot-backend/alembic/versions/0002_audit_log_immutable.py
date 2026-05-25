"""enforce audit_log immutability via trigger

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-25

Audit log must be append-only. We enforce this with a trigger that blocks
UPDATE and DELETE. Supabase RLS is layered on top via service-role bypass,
but the DB trigger is the hard guarantee.
"""
from alembic import op


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_log_block_modify() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit_log is append-only; UPDATE/DELETE not allowed';
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER audit_log_no_update
            BEFORE UPDATE ON audit_log
            FOR EACH ROW EXECUTE FUNCTION audit_log_block_modify();

        CREATE TRIGGER audit_log_no_delete
            BEFORE DELETE ON audit_log
            FOR EACH ROW EXECUTE FUNCTION audit_log_block_modify();
    """)


def downgrade() -> None:
    op.execute("""
        DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
        DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
        DROP FUNCTION IF EXISTS audit_log_block_modify();
    """)
