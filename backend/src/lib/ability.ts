import { AbilityBuilder, createMongoAbility } from '@casl/ability';

export function defineRulesFor(profil: any) {
  const { can, cannot, rules } = new AbilityBuilder(createMongoAbility);

  if (!profil) return rules;

  if (profil.peran === 'ADMIN') {
    can('manage', 'all');
    cannot('read', 'AslabPanel');
    cannot('read', 'KepalaLabPanel');
  } else if (profil.peran === 'ASLAB') {
    can('read', 'AslabPanel');
    can('read', 'Laporan');
    can('create', 'Laporan');
    can('update', 'Laporan');
    can('create', 'Seeding');
    can('read', 'Chatbot');
    can('create', 'Chatbot');
    can('delete', 'Chatbot');
    cannot('manage', 'AdminPanel');
    cannot('read', 'KepalaLabPanel');
  } else if (profil.peran === 'KEPALA_LAB') {
    can('read', 'KepalaLabPanel');
    can('read', 'Laporan');
    can('read', 'Summary');
    can('read', 'Chatbot');
    can('create', 'Chatbot');
    can('delete', 'Chatbot');
    cannot('create', 'Laporan');
    cannot('update', 'Laporan');
    cannot('manage', 'AdminPanel');
    cannot('read', 'AslabPanel');
  }
  return rules;

}
