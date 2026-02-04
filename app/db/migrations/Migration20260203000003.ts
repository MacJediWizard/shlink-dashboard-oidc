import { Migration } from '@mikro-orm/migrations';

export class Migration20260203000003 extends Migration {
  override async up(): Promise<void> {
    const knex = this.getKnex();

    await knex.schema.createTable('folders', (table) => {
      table.increments('id').unsigned().primary();
      table.string('name', 255).notNullable();
      table.string('color', 7).nullable();
      table.dateTime('created_at').notNullable();
      table.integer('user_id').unsigned().notNullable();
      table.integer('server_id').unsigned().notNullable();

      table.foreign('user_id', 'fk_folder_user')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE');
      table.foreign('server_id', 'fk_folder_server')
        .references('id')
        .inTable('servers')
        .onDelete('CASCADE');

      table.unique(['user_id', 'server_id', 'name'], {
        indexName: 'idx_folder_user_server_name',
      });
    });

    await knex.schema.createTable('folder_items', (table) => {
      table.increments('id').unsigned().primary();
      table.string('short_url_id', 255).notNullable();
      table.string('short_code', 255).notNullable();
      table.dateTime('added_at').notNullable();
      table.integer('folder_id').unsigned().notNullable();

      table.foreign('folder_id', 'fk_folder_item_folder')
        .references('id')
        .inTable('folders')
        .onDelete('CASCADE');

      table.unique(['folder_id', 'short_url_id'], {
        indexName: 'idx_folder_item_folder_shorturl',
      });
    });
  }

  override async down(): Promise<void> {
    const knex = this.getKnex();
    await knex.schema.dropTable('folder_items');
    await knex.schema.dropTable('folders');
  }
}
