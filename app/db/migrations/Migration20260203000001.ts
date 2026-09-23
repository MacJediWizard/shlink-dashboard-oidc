import { Migration } from '@mikro-orm/migrations';
import type { ColumnDefinitionBuilder } from 'kysely';

export class Migration20260203000001 extends Migration {
  override async up(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    const { idType, idColBuilder, fkType, dateType, jsonType } = this.columnTypes();

    await kysely.schema
      .createTable('audit_logs')
      .addColumn('id', idType, idColBuilder)
      .addColumn('action', 'varchar(50)', (column) => column.notNull())
      .addColumn('resource_type', 'varchar(50)')
      .addColumn('resource_id', 'varchar(255)')
      .addColumn('details', jsonType)
      .addColumn('ip_address', 'varchar(45)')
      .addColumn('user_agent', 'text')
      .addColumn('created_at', dateType, (column) => column.notNull())
      .addColumn('user_id', fkType)
      .addColumn('server_id', fkType)
      .addForeignKeyConstraint('fk_audit_user', ['user_id'], 'users', ['id'], (constraint) =>
        constraint.onDelete('set null'),
      )
      .addForeignKeyConstraint('fk_audit_server', ['server_id'], 'servers', ['id'], (constraint) =>
        constraint.onDelete('set null'),
      )
      .execute();

    await kysely.schema.createIndex('idx_audit_created_at').on('audit_logs').column('created_at').execute();
    await kysely.schema.createIndex('idx_audit_user_id').on('audit_logs').column('user_id').execute();
  }

  override async down(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    await kysely.schema.dropTable('audit_logs').execute();
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
