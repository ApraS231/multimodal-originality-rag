import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { Lucia } from "lucia";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { prisma } from "../db/prisma";
import { CONFIG } from "../config";
import { defineRulesFor } from "../lib/ability";
import { sessionCache } from "../lib/cache";

const adapter = new PrismaAdapter(prisma.sesi, prisma.pengguna);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: CONFIG.NODE_ENV === "production"
    }
  },
  getUserAttributes: (attributes: any) => {
    return {
      email: attributes.email,
      nama: attributes.nama
    };
  }
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      nama: string;
    };
  }
}

export async function validateSessionAndGetAbility(cookieHeader: string) {
  const sessionId = lucia.readSessionCookie(cookieHeader || "");
  if (!sessionId) {
    return { session: null, user: null, rules: [] };
  }

  const cached = sessionCache.get(sessionId);
  if (cached) {
    return cached;
  }

  const { session, user } = await lucia.validateSession(sessionId);
  if (!session || !user) {
    return { session: null, user: null, rules: [] };
  }

  const dbUser = await prisma.pengguna.findUnique({
    where: { id: user.id },
    include: { profil: true }
  });

  if (!dbUser || !dbUser.profil) {
    return { session, user, rules: [] };
  }

  const rules = defineRulesFor(dbUser.profil);
  const result = {
    session,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      nama: dbUser.nama,
      profil: {
        id_profil: dbUser.profil.id_profil,
        peran: dbUser.profil.peran,
        nim: dbUser.profil.nim,
        kode_aslab: dbUser.profil.kode_aslab,
        kode_kalab: dbUser.profil.kode_kalab,
        status_persetujuan: dbUser.profil.status_persetujuan
      }
    },
    rules
  };

  sessionCache.set(sessionId, result);
  return result;
}

export const authRouter = new Elysia({ prefix: "/api/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: CONFIG.JWT_SECRET
    })
  )
  .post(
    "/login",
    async ({ body, set, jwt }) => {
      const { email, password } = body;

      const user = await prisma.pengguna.findUnique({
        where: { email },
        include: { profil: true }
      });

      if (!user) {
        set.status = 400;
        return { error: "Email atau kata sandi tidak valid." };
      }

      const isValidPassword = await Bun.password.verify(password, user.kata_sandi);
      if (!isValidPassword) {
        set.status = 400;
        return { error: "Email atau kata sandi tidak valid." };
      }

      const session = await lucia.createSession(user.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      
      set.headers["Set-Cookie"] = sessionCookie.serialize();

      const token = await jwt.sign({
        userId: user.id,
        role: user.profil?.peran || "ASLAB"
      });

      const rules = defineRulesFor(user.profil);

      return {
        success: true,
        token,
        rules,
        user: {
          id: user.id,
          email: user.email,
          nama: user.nama,
          profil: user.profil
            ? {
                id_profil: user.profil.id_profil,
                peran: user.profil.peran,
                nim: user.profil.nim,
                kode_aslab: user.profil.kode_aslab,
                kode_kalab: user.profil.kode_kalab,
                status_persetujuan: user.profil.status_persetujuan
              }
            : null
        }
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String()
      })
    }
  )
  .post(
    "/register-aslab",
    async ({ body, set }) => {
      const { nama, email, password, nim } = body;

      const existingUser = await prisma.pengguna.findUnique({
        where: { email }
      });
      if (existingUser) {
        set.status = 400;
        return { error: "Email sudah terdaftar." };
      }

      const hashedPassword = await Bun.password.hash(password);

      const newUser = await prisma.$transaction(async (tx) => {
        // Cari profile aslab dengan kode_aslab berformat AS-XX tertinggi
        const lastAslabProfile = await tx.profilPengguna.findFirst({
          where: {
            peran: "ASLAB",
            kode_aslab: {
              startsWith: "AS-"
            }
          },
          orderBy: {
            kode_aslab: "desc"
          }
        });

        let nextNum = 1;
        if (lastAslabProfile && lastAslabProfile.kode_aslab) {
          const lastNum = parseInt(lastAslabProfile.kode_aslab.replace("AS-", ""), 10);
          if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
          }
        }
        const generatedKodeAslab = `AS-${String(nextNum).padStart(2, "0")}`;

        const u = await tx.pengguna.create({
          data: {
            nama,
            email,
            kata_sandi: hashedPassword,
          }
        });

        await tx.profilPengguna.create({
          data: {
            id_pengguna: u.id,
            peran: "ASLAB",
            nim,
            kode_aslab: generatedKodeAslab,
            status_persetujuan: "PENDING"
          }
        });

        return u;
      });

      return { success: true, message: "Pendaftaran berhasil. Silakan hubungi Administrator untuk persetujuan akun Anda." };
    },
    {
      body: t.Object({
        nama: t.String(),
        email: t.String({ format: "email" }),
        password: t.String(),
        nim: t.String()
      })
    }
  )
  .post("/logout", async ({ headers, set }) => {
    const sessionId = lucia.readSessionCookie(headers.cookie || "");
    if (sessionId) {
      await lucia.invalidateSession(sessionId);
      sessionCache.delete(sessionId);
    }
    const sessionCookie = lucia.createBlankSessionCookie();
    set.headers["Set-Cookie"] = sessionCookie.serialize();
    return { success: true };
  })
  .get("/session", async ({ headers }) => {
    return await validateSessionAndGetAbility(headers.cookie || "");
  })
  .get("/profile", async ({ headers, set }) => {
    const sessionData = await validateSessionAndGetAbility(headers.cookie || "");
    if (!sessionData.user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const profil = await prisma.profilPengguna.findUnique({
      where: { id_pengguna: sessionData.user.id },
      include: {
        kelas_aslab: {
          select: { id_kelas: true }
        },
        matkul_aslab: {
          select: { id_mata_kuliah: true }
        }
      }
    });

    return {
      user: sessionData.user,
      profil: profil ? {
        id_profil: profil.id_profil,
        id_pengguna: profil.id_pengguna,
        peran: profil.peran,
        nim: profil.nim,
        kode_aslab: profil.kode_aslab,
        kode_kalab: profil.kode_kalab,
        tanggal_dibuat: profil.tanggal_dibuat,
        kelas_aslab: profil.kelas_aslab.map(k => k.id_kelas),
        matkul_aslab: profil.matkul_aslab.map(m => m.id_mata_kuliah)
      } : null
    };
  })
  .post("/profile/assignments", async ({ headers, body, set }: any) => {
    const sessionData = await validateSessionAndGetAbility(headers.cookie || "");
    if (!sessionData.user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const userPeran = sessionData.user.profil?.peran || (sessionData.user as any).peran;
    if (userPeran !== "ADMIN") {
      set.status = 403;
      return { error: "Penugasan kelas dan mata kuliah bimbingan hanya dapat diatur secara terpusat oleh Administrator Laboratorium." };
    }

    const { kelasIds, matkulIds } = body;

    const profil = await prisma.profilPengguna.findUnique({
      where: { id_pengguna: sessionData.user.id }
    });

    if (!profil) {
      set.status = 404;
      return { error: "Profil tidak ditemukan" };
    }

    await prisma.$transaction([
      prisma.kelasAslab.deleteMany({
        where: { id_profil: profil.id_profil }
      }),
      prisma.matkulAslab.deleteMany({
        where: { id_profil: profil.id_profil }
      }),
      ...(kelasIds && kelasIds.length > 0 ? [
        prisma.kelasAslab.createMany({
          data: kelasIds.map((id_kelas: string) => ({
            id_profil: profil.id_profil,
            id_kelas
          }))
        })
      ] : []),
      ...(matkulIds && matkulIds.length > 0 ? [
        prisma.matkulAslab.createMany({
          data: matkulIds.map((id_mata_kuliah: string) => ({
            id_profil: profil.id_profil,
            id_mata_kuliah
          }))
        })
      ] : [])
    ]);

    return { success: true };
  })
  .put("/profile", async ({ headers, body, set }: any) => {
    const sessionData = await validateSessionAndGetAbility(headers.cookie || "");
    if (!sessionData.user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { nama, nim, password } = body;
    if (!nama || !nama.trim()) {
      set.status = 400;
      return { error: "Nama wajib diisi" };
    }

    const updateData: any = { nama: nama.trim() };
    if (password && password.trim()) {
      updateData.kata_sandi = await Bun.password.hash(password);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update nama & password di tabel Pengguna
      await tx.pengguna.update({
        where: { id: sessionData.user.id },
        data: updateData
      });

      // 2. Update NIM di tabel ProfilPengguna (jika ada profilnya)
      if (nim !== undefined) {
        await tx.profilPengguna.update({
          where: { id_pengguna: sessionData.user.id },
          data: { nim: nim.trim() ? nim.trim() : null }
        });
      }
    });

    return { success: true };
  })

  // Personalisasi Tampilan File Manager per Pengguna (Warna & Proteksi Kunci Lokal Akun)
  .get("/preferences/filemanager", async ({ headers, set }: any) => {
    const sessionData = await validateSessionAndGetAbility(headers.cookie || "");
    if (!sessionData.user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const config = await prisma.konfigurasiSistem.findUnique({
      where: { id_konfigurasi: `user_pref_${sessionData.user.id}` }
    });

    if (!config || !config.kunci_kustom) {
      return {
        folderColors: {},
        lockedFolders: {}
      };
    }

    const customData = config.kunci_kustom as any;
    return {
      folderColors: customData.folderColors || {},
      lockedFolders: customData.lockedFolders || {}
    };
  })
  .put(
    "/preferences/filemanager",
    async ({ headers, body, set }: any) => {
      const sessionData = await validateSessionAndGetAbility(headers.cookie || "");
      if (!sessionData.user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const folderColors = body.folderColors || {};
      const lockedFolders = body.lockedFolders || {};

      const updated = await prisma.konfigurasiSistem.upsert({
        where: { id_konfigurasi: `user_pref_${sessionData.user.id}` },
        update: {
          kunci_kustom: {
            folderColors,
            lockedFolders
          }
        },
        create: {
          id_konfigurasi: `user_pref_${sessionData.user.id}`,
          nama_model_ai: "user_preference",
          prompt_sistem: `Personalisasi Direktori File Manager Pengguna ${sessionData.user.id}`,
          kunci_kustom: {
            folderColors,
            lockedFolders
          }
        }
      });

      const resData = updated.kunci_kustom as any;
      return {
        success: true,
        data: {
          folderColors: resData.folderColors || {},
          lockedFolders: resData.lockedFolders || {}
        }
      };
    },
    {
      body: t.Object({
        folderColors: t.Optional(t.Record(t.String(), t.String())),
        lockedFolders: t.Optional(t.Record(t.String(), t.Boolean()))
      })
    }
  );


