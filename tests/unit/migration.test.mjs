import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../../migrations/001_offline_sync.sql', import.meta.url), 'utf8');

test('offline migration is additive and binds customer/comment events to branch scope', () => {
  assert.match(migration, /`idsucursal` INT NOT NULL/);
  assert.match(migration, /CREATE VIEW `mobile_customer_branch`/);
  assert.match(migration, /CREATE VIEW `mobile_comment_branch`/);
  assert.match(migration, /JOIN mobile_customer_branch mcb\s+ON mcb\.idcliente=customer\.idcliente AND mcb\.idglobal=customer\.idglobal/);
  assert.match(migration, /e\.record_type='customer' AND e\.action='INSERT'/);
  assert.match(migration, /CREATE TRIGGER `trg_mobile_event_order` BEFORE INSERT ON `mobile_change_event`/);
  assert.match(migration, /CREATE TRIGGER `trg_mobile_comentario_cliente_bd` BEFORE DELETE/);
  assert.match(migration, /'DELETE'/);
  assert.doesNotMatch(migration, /^\s*(?:DROP|ALTER)\s+TABLE\b/im);
  assert.doesNotMatch(migration, /JSON_(?:OBJECT|ARRAY|EXTRACT)/i);
});

const authorMigration = await readFile(new URL('../../migrations/002_payment_author.sql', import.meta.url), 'utf8');

test('payment author migration only adds nullable, re-runnable columns to tbl_descripcion', () => {
  assert.match(authorMigration, /ADD COLUMN IF NOT EXISTS `idusuario` INT NULL/);
  assert.match(authorMigration, /ADD COLUMN IF NOT EXISTS `str_origen` VARCHAR\(20\) NULL/);
  assert.match(authorMigration, /ADD INDEX IF NOT EXISTS `ix_descripcion_usuario`/);
  assert.doesNotMatch(authorMigration, /^\s*(?:DROP|UPDATE|DELETE|INSERT)\b/im);
  assert.doesNotMatch(authorMigration, /NOT NULL/);
});
