import { Migration } from '@mikro-orm/migrations';
import type { ColumnDefinitionBuilder } from 'kysely';

export class Migration20260203000003 extends Migration {
  override async up(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    const { idType, idColBuilder, fkType, dateType } = this.columnTypes();

    await kysely.schema
      .createTable('folders')
      .addColumn('id', idType, idColBuilder)
      .addColumn('name', 'varchar(255)', (column) => column.notNull())
      .addColumn('color', 'varchar(7)')
      .addColumn('created_at', dateType, (column) => column.notNull())
      .addColumn('user_id', fkType, (column) => column.notNull())
      .addColumn('server_id', fkType, (column) => column.notNull())
      .addForeignKeyConstraint('fk_folder_user', ['user_id'], 'users', ['id'], (constraint) =>
        constraint.onDelete('cascade'),
      )
      .addForeignKeyConstraint('fk_folder_server', ['server_id'], 'servers', ['id'], (constraint) =>
        constraint.onDelete('cascade'),
      )
      .addUniqueConstraint('idx_folder_user_server_name', ['user_id', 'server_id', 'name'])
      .execute();

    await kysely.schema
      .createTable('folder_items')
      .addColumn('id', idType, idColBuilder)
      .addColumn('short_url_id', 'varchar(255)', (column) => column.notNull())
      .addColumn('short_code', 'varchar(255)', (column) => column.notNull())
      .addColumn('added_at', dateType, (column) => column.notNull())
      .addColumn('folder_id', fkType, (column) => column.notNull())
      .addForeignKeyConstraint('fk_folder_item_folder', ['folder_id'], 'folders', ['id'], (constraint) =>
        constraint.onDelete('cascade'),
      )
      .addUniqueConstraint('idx_folder_item_folder_shorturl', ['folder_id', 'short_url_id'])
      .execute();
  }

  override async down(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    await kysely.schema.dropTable('folder_items').execute();
    await kysely.schema.dropTable('folders').execute();
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
