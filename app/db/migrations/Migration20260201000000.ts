import { Migration } from '@mikro-orm/migrations';

export class Migration20260201000000 extends Migration {
  override async up(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    await kysely.schema.alterTable('users').addColumn('oidc_subject', 'varchar(255)').execute();
    await kysely.schema
      .alterTable('users')
      .addUniqueConstraint('users_oidc_subject_unique', ['oidc_subject'])
      .execute();
  }

  override async down(): Promise<void> {
    const kysely = this.getEntityManager().getKysely();
    await kysely.schema.alterTable('users').dropConstraint('users_oidc_subject_unique').execute();
    await kysely.schema.alterTable('users').dropColumn('oidc_subject').execute();
  }
}
