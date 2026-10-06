import { createMongoAbility } from '@casl/ability';
import { validateSessionAndGetAbility } from './auth';

export const checkAbility = (action: string, subject: string) => {
  return async (context: any) => {
    const { headers, set } = context;
    const { session, user, rules } = await validateSessionAndGetAbility(headers.cookie || "");
    if (!session || !user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const ability = createMongoAbility(rules);
    if (ability.cannot(action, subject)) {
      set.status = 403;
      return { error: "Forbidden Access" };
    }

    context.activeUser = {
      ...user,
      peran: user.profil?.peran || user.peran
    };
    context.activeSession = session;
  };
};
