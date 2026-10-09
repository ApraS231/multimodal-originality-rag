import { AbilityBuilder, createMongoAbility } from '@casl/ability';

export function defineRulesFor(profil: any) {
  const { can, cannot, rules } = new AbilityBuilder(createMongoAbility);

  if (!profil) return rules;

  const peran = (profil.peran || '').toUpperCase();

  if (peran === 'ADMIN') {
    can('manage', 'all');
    can('read', 'AdminPanel');
    can('read', 'AslabPanel');
    can('read', 'KepalaLabPanel');
    can('read', 'Laporan');
  } else if (peran === 'ASLAB') {
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
  } else if (peran === 'KEPALA_LAB') {
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
