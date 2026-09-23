import { Migration } from '@mikro-orm/migrations';
import type { ColumnDefinitionBuilder } from 'kysely';
import { sql } from 'kysely';

export class Migration20260203000004 extends Migration {
  override async up(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    const { idType, idColBuilder, fkType, dateType, jsonType, boolType } = this.columnTypes();

    await kysely.schema
      .createTable('api_key_registry')
      .addColumn('id', idType, idColBuilder)
      .addColumn('name', 'varchar(255)', (column) => column.notNull())
      .addColumn('description', 'text')
      .addColumn('key_hint', 'varchar(10)', (column) => column.notNull())
      .addColumn('service', 'varchar(50)', (column) => column.notNull())
      .addColumn('tags', jsonType, (column) => column.notNull().defaultTo(sql`'[]'`))
      .addColumn('expires_at', dateType)
      .addColumn('last_used_at', dateType)
      .addColumn('usage_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('is_active', boolType, (column) => column.notNull().defaultTo(true))
      .addColumn('notes', 'text')
      .addColumn('created_at', dateType, (column) => column.notNull())
      .addColumn('updated_at', dateType, (column) => column.notNull())
      .addColumn('user_id', fkType, (column) => column.notNull())
      .addColumn('server_id', fkType, (column) => column.notNull())
      .addForeignKeyConstraint('fk_apikey_user', ['user_id'], 'users', ['id'], (constraint) =>
        constraint.onDelete('cascade'),
      )
      .addForeignKeyConstraint('fk_apikey_server', ['server_id'], 'servers', ['id'], (constraint) =>
        constraint.onDelete('cascade'),
      )
      .execute();

    await kysely.schema
      .createIndex('idx_apikey_user_server')
      .on('api_key_registry')
      .columns(['user_id', 'server_id'])
      .execute();
    await kysely.schema.createIndex('idx_apikey_service').on('api_key_registry').column('service').execute();
  }

  override async down(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    await kysely.schema.dropTable('api_key_registry').execute();
  }

  private columnTypes() {
    const driverName = this.getEntityManager().getDriver().constructor.name.toLowerCase();
    const isPostgres = driverName.includes('postgres');
    const isSqlite = driverName.includes('sqlite');
    const isMicrosoft = driverName.includes('mssql');

    return {
      idType: isPostgres ? 'serial' : 'integer',
      idColBuilder: (column: ColumnDefinitionBuilder) => {
        if (isPostgres) {
          // In postgres, autoincrement is implicit by the serial type
          return column.primaryKey();
        }
        if (isMicrosoft) {
          return column.identity().primaryKey();
        }
        return column.autoIncrement().primaryKey();
      },
      fkType: isSqlite ? 'integer' : 'bigint',
      dateType: isPostgres ? 'timestamp' : 'datetime',
      jsonType: isMicrosoft ? 'text' : 'json',
      boolType: isMicrosoft ? sql`bit` : sql`boolean`,
    } as const;
  }
}
