import { Migration } from '@mikro-orm/migrations';
import type { ColumnDefinitionBuilder } from 'kysely';

export class Migration20260203000002 extends Migration {
  override async up(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    const { idType, idColBuilder, fkType, dateType } = this.columnTypes();

    await kysely.schema
      .createTable('favorites')
      .addColumn('id', idType, idColBuilder)
      .addColumn('short_url_id', 'varchar(255)', (column) => column.notNull())
      .addColumn('short_code', 'varchar(255)', (column) => column.notNull())
      .addColumn('long_url', 'text', (column) => column.notNull())
      .addColumn('title', 'varchar(255)')
      .addColumn('notes', 'text')
      .addColumn('created_at', dateType, (column) => column.notNull())
      .addColumn('user_id', fkType, (column) => column.notNull())
      .addColumn('server_id', fkType, (column) => column.notNull())
      .addForeignKeyConstraint('fk_favorite_user', ['user_id'], 'users', ['id'], (constraint) =>
        constraint.onDelete('cascade'),
      )
      .addForeignKeyConstraint('fk_favorite_server', ['server_id'], 'servers', ['id'], (constraint) =>
        constraint.onDelete('cascade'),
      )
      .addUniqueConstraint('idx_favorite_user_server_shorturl', ['user_id', 'server_id', 'short_url_id'])
      .execute();
  }

  override async down(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    await kysely.schema.dropTable('favorites').execute();
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
    } as const;
  }
}
