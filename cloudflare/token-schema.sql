DROP TABLE IF EXISTS token_index;
CREATE TABLE token_index (token TEXT NOT NULL, seq INTEGER NOT NULL, ids BLOB NOT NULL, PRIMARY KEY(token, seq));
