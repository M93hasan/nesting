-- Idempotent baseline for new and existing Serula databases.
-- No users, passwords or credits are overwritten.

CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT,
      google_id TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      nesting_credits INTEGER NOT NULL DEFAULT 5 CHECK(nesting_credits>=0),
      unlimited INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    );

CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS password_reset_tokens (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS user_settings (user_id INTEGER PRIMARY KEY, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS user_features (user_id INTEGER PRIMARY KEY, test_dxf_enabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS user_corel_transfer_access (user_id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS transfer_tickets (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, target TEXT NOT NULL CHECK(target='corel'), expires_at TEXT NOT NULL, redeemed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY,
      locale TEXT NOT NULL DEFAULT 'tr' CHECK(locale IN ('tr','en','ar','fa')),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS user_licenses (
      user_id INTEGER PRIMARY KEY,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_user_licenses_expires ON user_licenses(expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_type TEXT NOT NULL, actor_user_id INTEGER, target_user_id INTEGER, action TEXT NOT NULL, detail TEXT, success INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_user_id);

CREATE TABLE IF NOT EXISTS support_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      approved_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_support_sessions_user ON support_sessions(user_id);

CREATE TABLE IF NOT EXISTS support_signals (
      session_id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'settings',
      offer_json TEXT,
      answer_json TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES support_sessions(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS support_frames (
      session_id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      frame_data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES support_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender TEXT NOT NULL CHECK(sender IN ('user','admin')),
      body TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id,id);

CREATE TABLE IF NOT EXISTS nesting_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_name TEXT,
      source_file_name TEXT,
      used_credit INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_nesting_history_user ON nesting_history(user_id,id);

CREATE TABLE IF NOT EXISTS export_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_name TEXT NOT NULL DEFAULT '',
      source_file_name TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      dxf_text TEXT NOT NULL,
      project_json TEXT,
      byte_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_export_files_user_created ON export_files(user_id,id DESC);

CREATE TRIGGER IF NOT EXISTS serula_export_charge_v1
      BEFORE INSERT ON export_files BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND (unlimited=1 OR nesting_credits>0))
          THEN RAISE(ABORT,'serula_no_credits') END;
        INSERT INTO nesting_history(user_id,project_name,source_file_name,used_credit)
          SELECT id,NEW.project_name,NEW.source_file_name,CASE WHEN unlimited=1 THEN 0 ELSE 1 END FROM users WHERE id=NEW.user_id;
        UPDATE users SET nesting_credits=nesting_credits-1 WHERE id=NEW.user_id AND unlimited=0;
      END;

CREATE TABLE IF NOT EXISTS export_file_chunks (
      export_id INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('dxf','project')),
      chunk_index INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY(export_id,kind,chunk_index),
      FOREIGN KEY (export_id) REFERENCES export_files(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_export_file_chunks_export ON export_file_chunks(export_id,kind,chunk_index);

CREATE TABLE IF NOT EXISTS cloud_projects (
      user_id INTEGER PRIMARY KEY,
      label TEXT NOT NULL DEFAULT 'Serula Nesting En Temiz Hali',
      project_name TEXT NOT NULL DEFAULT '',
      byte_size INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS cloud_project_chunks (
      user_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY(user_id,chunk_index),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_cloud_project_chunks_user ON cloud_project_chunks(user_id,chunk_index);

CREATE TABLE IF NOT EXISTS user_presence (
      user_id INTEGER PRIMARY KEY,
      last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_user_presence_seen ON user_presence(last_seen);
