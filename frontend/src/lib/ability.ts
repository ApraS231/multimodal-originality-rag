import { createMongoAbility } from '@casl/ability';

export type Actions = 'read' | 'create' | 'update' | 'delete' | 'manage';
export type Subjects = 'Laporan' | 'Prodi' | 'Kelas' | 'Matkul' | 'AdminPanel' | 'AslabPanel' | 'KepalaLabPanel' | 'Chatbot' | 'all';

export const createAbility = (rules: any) => {
  return createMongoAbility<[Actions, Subjects]>(rules);
};
