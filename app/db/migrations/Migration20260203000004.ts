import { Migration } from '@mikro-orm/migrations';

export class Migration20260203000004 extends Migration {
  override async up(): Promise<void> {
    const knex = this.getKnex();
    await knex.schema.createTable('api_key_registry', (table) => {
      table.increments('id').unsigned().primary();
      table.string('name', 255).notNullable();
      table.text('description').nullable();
      table.string('key_hint', 10).notNullable();
      table.string('service', 50).notNullable();
      table.json('tags').notNullable().defaultTo('[]');
      table.dateTime('expires_at').nullable();
      table.dateTime('last_used_at').nullable();
      table.integer('usage_count').unsigned().notNullable().defaultTo(0);
      table.boolean('is_active').notNullable().defaultTo(true);
      table.text('notes').nullable();
      table.dateTime('created_at').notNullable();
      table.dateTime('updated_at').notNullable();
      table.integer('user_id').unsigned().notNullable();
      table.integer('server_id').unsigned().notNullable();

      table.foreign('user_id', 'fk_apikey_user')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
      table.foreign('server_id', 'fk_apikey_server')
        .references('id')
        .inTable('servers')
        .onDelete('CASCADE');

      table.index(['user_id', 'server_id'], 'idx_apikey_user_server');
      table.index(['service'], 'idx_apikey_service');
    });
  }

  override async down(): Promise<void> {
    const knex = this.getKnex();
    await knex.schema.dropTable('api_key_registry');
  }
}
