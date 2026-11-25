ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD CONSTRAINT users_deleted_inactive_check CHECK (deleted_at IS NULL OR active = false);
ALTER TABLE requesters DROP CONSTRAINT requesters_contact_check;
ALTER TABLE requesters ADD CONSTRAINT requesters_contact_check CHECK (anonymized_at IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL);
ALTER TABLE requesters DROP CONSTRAINT requesters_accepts_data_processing_check;
ALTER TABLE requesters ADD CONSTRAINT requesters_accepts_data_processing_check CHECK (anonymized_at IS NOT NULL OR accepts_data_processing = true);

-- Erased rows cannot be restored by a stale request or an administrator.
CREATE FUNCTION reject_erased_identity_changes() RETURNS trigger AS $$
BEGIN
  IF (TG_TABLE_NAME = 'users' AND to_jsonb(OLD)->>'deleted_at' IS NOT NULL)
     OR (TG_TABLE_NAME = 'requesters' AND to_jsonb(OLD)->>'anonymized_at' IS NOT NULL) THEN
    RAISE EXCEPTION 'La identidad suprimida no se puede modificar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER users_erased_identity BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_erased_identity_changes();
CREATE TRIGGER requesters_erased_identity BEFORE UPDATE ON requesters FOR EACH ROW EXECUTE FUNCTION reject_erased_identity_changes();

-- D-08 keeps events immutable; HU-33 only allows nulling personal comments.
DROP TRIGGER status_history_insert_only ON status_history;
CREATE OR REPLACE FUNCTION status_history_reject_changes() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.comment IS NULL
     AND (to_jsonb(NEW) - 'comment') = (to_jsonb(OLD) - 'comment')
     AND EXISTS (
       SELECT 1 FROM users u WHERE u.id::text = current_setting('trackhive.erasing_user', true)
       AND u.deleted_at IS NULL AND (OLD.user_id = u.id OR EXISTS (
         SELECT 1 FROM requests r JOIN requesters q ON q.id = r.requester_id
         WHERE r.id = OLD.request_id AND q.user_id = u.id
       ))
     ) THEN RETURN NEW;
  END IF;
  RAISE EXCEPTION 'status_history solo admite INSERT (D-08), salvo supresión de comentarios (HU-33)';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER status_history_insert_only BEFORE UPDATE OR DELETE ON status_history
  FOR EACH ROW EXECUTE FUNCTION status_history_reject_changes();
CREATE TRIGGER status_history_no_truncate BEFORE TRUNCATE ON status_history
  FOR EACH STATEMENT EXECUTE FUNCTION status_history_reject_changes();
