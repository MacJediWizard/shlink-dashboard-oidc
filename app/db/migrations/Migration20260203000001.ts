import { Migration } from '@mikro-orm/migrations';

export class Migration20260203000001 extends Migration {
  override async up(): Promise<void> {
    const knex = this.getKnex();
    await knex.schema.createTable('audit_logs', (table) => {
      table.increments('id').unsigned().primary();
      table.string('action', 50).notNullable();
      table.string('resource_type', 50).nullable();
      table.string('resource_id', 255).nullable();
      table.json('details').nullable();
      table.string('ip_address', 45).nullable();
      table.text('user_agent').nullable();
      table.dateTime('created_at').notNullable();
      table.integer('user_id').unsigned().nullable();
      table.integer('server_id').unsigned().nullable();

      table.foreign('user_id', 'fk_audit_user')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL');
      table.foreign('server_id', 'fk_audit_server')
        .references('id')
        .inTable('servers')
        .onDelete('SET NULL');

      table.index('created_at', 'idx_audit_created_at');
      table.index('user_id', 'idx_audit_user_id');
    });
  }

  override async down(): Promise<void> {
    const knex = this.getKnex();
    await knex.schema.dropTable('audit_logs');
  }
}
