import { Migration } from '@mikro-orm/migrations';

export class Migration20260203000002 extends Migration {
  override async up(): Promise<void> {
    const knex = this.getKnex();
    await knex.schema.createTable('favorites', (table) => {
      table.increments('id').unsigned().primary();
      table.string('short_url_id', 255).notNullable();
      table.string('short_code', 255).notNullable();
      table.text('long_url').notNullable();
      table.string('title', 255).nullable();
      table.text('notes').nullable();
      table.dateTime('created_at').notNullable();
      table.integer('user_id').unsigned().notNullable();
      table.integer('server_id').unsigned().notNullable();

      table.foreign('user_id', 'fk_favorite_user')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
      table.foreign('server_id', 'fk_favorite_server')
        .references('id')
        .inTable('servers')
        .onDelete('CASCADE');

      table.unique(['user_id', 'server_id', 'short_url_id'], {
        indexName: 'idx_favorite_user_server_shorturl',
      });
    });
  }

  override async down(): Promise<void> {
    const knex = this.getKnex();
    await knex.schema.dropTable('favorites');
  }
}
