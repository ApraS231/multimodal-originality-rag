import { Elysia, t } from "elysia";
import { prisma } from "../db/prisma";
import { checkAbility } from "./auth-guard";
import { generateServiceToken } from "../lib/jwt-helper";
import { CONFIG } from "../config";

function checkOutOfDomainSecurity(teks: string): string | null {
  const lower = teks.toLowerCase().trim();

  // 1. Upaya akses data pengguna / kredensial akun rahasia
  const userCredTriggers = [
    "kata sandi", "password", "hash password", "hash kata sandi",
    "kunci api", "api key", "jwt_secret", "jwt secret", "session cookie",
    "token sesi", "daftar password", "bocorkan password", "lihat password",
    "select * from pengguna", "tabel pengguna", "data user", "data pengguna",
    "daftar pengguna", "daftar user", "email user", "email pengguna"
  ];
  if (
    userCredTriggers.some(t => lower.includes(t)) &&
    ["tampilkan", "lihat", "bocorkan", "apa", "berikan", "minta", "cari", "siapa", "semua", "tahu"].some(k => lower.includes(k))
  ) {
    return "Mohon maaf, akses terhadap data akun pengguna, kredensial login, kata sandi, dan data sensitif pengguna diblokir demi menjaga keamanan sistem dan kepatuhan privasi data.";
  }

  // 2. Pertanyaan kuliner/resep/makanan di luar lingkup sistem
  const recipeTriggers = [
    "resep", "mangut lele", "cara masak", "cara membuat makanan", "bumbu masak", 
    "resep masakan", "bumbu mangut", "cara memasak", "resep kue", "resep makanan",
    "kuliner", "bahan masakan"
  ];
  if (recipeTriggers.some(t => lower.includes(t))) {
    return "Mohon maaf, lingkup pembahasan asisten AI dibatasi khusus seputar operasional sistem, aplikasi, metodologi deteksi orisinalitas, serta basis data laporan akademik VERITAS STITEK Bontang. Pertanyaan mengenai resep masakan atau topik di luar sistem tidak dapat diproses.";
  }

  return null;
}

export const chatbotRouter = new Elysia({ prefix: "/api/chatbot" })
  // Mendapatkan semua sesi obrolan pengguna aktif
  .get("/sessions", async ({ activeUser }: any) => {
    return await prisma.sesiObrolan.findMany({
      where: { id_pengguna: activeUser.id },
      include: {
        laporan: {
          select: {
            id_laporan: true,
            nama_mahasiswa: true,
            nim: true
          }
        },
        _count: {
          select: { pesan_obrolan: true }
        }
      },
      orderBy: { tanggal_diperbarui: "desc" }
    });
  }, {
    beforeHandle: checkAbility("read", "Chatbot")
  })

  // Membuat sesi obrolan baru
  .post(
    "/sessions",
    async ({ body, activeUser, set }: any) => {
      const { judul_sesi, id_laporan } = body;
      const peran = activeUser.profil?.peran || activeUser.peran;

      // Jalankan Context Isolation Guard jika id_laporan disertakan
      if (id_laporan) {
        const laporan = await prisma.laporan.findUnique({
          where: { id_laporan }
        });
        if (!laporan) {
          set.status = 404;
          return { error: "Laporan tidak ditemukan." };
        }
        if (peran === "MAHASISWA" && laporan.id_pengunggah !== activeUser.id) {
          set.status = 403;
          return { error: "Forbidden: Anda tidak memiliki akses ke laporan ini." };
        }
        if (peran === "ASLAB" && laporan.id_pengunggah !== activeUser.id) {
          const profil = await prisma.profilPengguna.findUnique({
            where: { id_pengguna: activeUser.id },
            include: { kelas_aslab: true, matkul_aslab: true }
          });
          const kelasIds = profil?.kelas_aslab.map(k => k.id_kelas) || [];
          const matkulIds = profil?.matkul_aslab.map(m => m.id_mata_kuliah) || [];
          let isAllowed = false;
          if (kelasIds.length > 0 && matkulIds.length > 0) {
            isAllowed = kelasIds.includes(laporan.id_kelas) && matkulIds.includes(laporan.id_mata_kuliah);
          } else if (kelasIds.length > 0) {
            isAllowed = kelasIds.includes(laporan.id_kelas);
          } else if (matkulIds.length > 0) {
            isAllowed = matkulIds.includes(laporan.id_mata_kuliah);
          }
          if (!isAllowed) {
            set.status = 403;
            return { error: "Forbidden: Anda tidak berwenang mengakses laporan di luar penugasan kelas dan mata kuliah Anda." };
          }
        }
      }

      return await prisma.sesiObrolan.create({
        data: {
          judul_sesi,
          id_pengguna: activeUser.id,
          id_laporan: id_laporan || null
        }
      });
    },
    {
      beforeHandle: checkAbility("create", "Chatbot"),
      body: t.Object({
        judul_sesi: t.String(),
        id_laporan: t.Optional(t.Nullable(t.String()))
      })
    }
  )

  // Mendapatkan detail sesi obrolan dengan histori pesannya
  .get("/sessions/:id", async ({ params, activeUser, set }: any) => {
    const { id } = params;

    const sesi = await prisma.sesiObrolan.findFirst({
      where: {
        id_sesi_obrolan: id,
        id_pengguna: activeUser.id
      },
      include: {
        pesan_obrolan: {
          orderBy: { tanggal_dibuat: "asc" }
        },
        laporan: true
      }
    });

    if (!sesi) {
      set.status = 404;
      return { error: "Sesi obrolan tidak ditemukan." };
    }

    return sesi;
  }, {
    beforeHandle: checkAbility("read", "Chatbot")
  })

  // Menghapus sesi obrolan (hanya milik pengguna aktif)
  .delete(
    "/sessions/:id",
    async ({ params, activeUser, set }: any) => {
      const { id } = params;

      const sesi = await prisma.sesiObrolan.findFirst({
        where: {
          id_sesi_obrolan: id,
          id_pengguna: activeUser.id
        }
      });

      if (!sesi) {
        set.status = 404;
        return { error: "Sesi obrolan tidak ditemukan atau bukan milik Anda." };
      }

      await prisma.pesanObrolan.deleteMany({
        where: { id_sesi_obrolan: id }
      });

      await prisma.sesiObrolan.delete({
        where: { id_sesi_obrolan: id }
      });

      return { success: true, message: "Sesi obrolan berhasil dihapus." };
    },
    {
      beforeHandle: checkAbility("delete", "Chatbot")
    }
  )

  // Mengirim pesan obrolan baru (Chatbot)
  .post(
    "/message",
    async ({ body, activeUser, set }: any) => {
      const { id_sesi_obrolan, teks, id_laporan } = body;
      const peran = activeUser.profil?.peran || activeUser.peran;

      // 1. Ambil batasan kuota harian dari konfigurasi sistem global
      const systemConfig = await prisma.konfigurasiSistem.findUnique({
        where: { id_konfigurasi: "global" }
      });
      const batasPesan = systemConfig?.batas_pesan || 50;

      // 2. Ambil tanggal hari ini (Format: YYYY-MM-DD)
      const today = new Date().toISOString().split("T")[0] as string;

      // 3. Cari/buat catatan penggunaan chatbot hari ini
      let penggunaan = await prisma.penggunaanChatbot.findFirst({
        where: {
          id_pengguna: activeUser.id,
          tanggal: today
        }
      });

      if (!penggunaan) {
        penggunaan = await prisma.penggunaanChatbot.create({
          data: {
            id_pengguna: activeUser.id,
            tanggal: today,
            jumlah: 0
          }
        });
      }

      // 4. Validasi kuota harian
      if (penggunaan.jumlah >= batasPesan) {
        set.status = 429;
        return { error: `Batas kuota harian terlampaui (${batasPesan} pesan). Silakan coba lagi besok.` };
      }

      // 5. Context Isolation Guard (jika ada laporan)
      if (id_laporan) {
        const laporan = await prisma.laporan.findUnique({
          where: { id_laporan }
        });
        if (!laporan) {
          set.status = 404;
          return { error: "Laporan tidak ditemukan." };
        }
        if (peran === "MAHASISWA" && laporan.id_pengunggah !== activeUser.id) {
          set.status = 403;
          return { error: "Forbidden: Anda tidak memiliki akses ke laporan ini." };
        }
        if (peran === "ASLAB" && laporan.id_pengunggah !== activeUser.id) {
          const profil = await prisma.profilPengguna.findUnique({
            where: { id_pengguna: activeUser.id },
            include: { kelas_aslab: true, matkul_aslab: true }
          });
          const kelasIds = profil?.kelas_aslab.map(k => k.id_kelas) || [];
          const matkulIds = profil?.matkul_aslab.map(m => m.id_mata_kuliah) || [];
          let isAllowed = false;
          if (kelasIds.length > 0 && matkulIds.length > 0) {
            isAllowed = kelasIds.includes(laporan.id_kelas) && matkulIds.includes(laporan.id_mata_kuliah);
          } else if (kelasIds.length > 0) {
            isAllowed = kelasIds.includes(laporan.id_kelas);
          } else if (matkulIds.length > 0) {
            isAllowed = matkulIds.includes(laporan.id_mata_kuliah);
          }
          if (!isAllowed) {
            set.status = 403;
            return { error: "Forbidden: Anda tidak berwenang mengakses laporan di luar penugasan kelas dan mata kuliah Anda." };
          }
        }
      }

      // 6. Tentukan atau buat sesi obrolan aktif secara otomatis (Strict User Isolation)
      let activeSessionId = id_sesi_obrolan;
      if (activeSessionId) {
        const existing = await prisma.sesiObrolan.findUnique({
          where: { id_sesi_obrolan: activeSessionId }
        });
        // Pastikan sesi ini benar-benar milik pengguna yang sedang aktif
        if (!existing || existing.id_pengguna !== activeUser.id) {
          activeSessionId = null;
        }
      }

      if (!activeSessionId) {
        const autoTitle = id_laporan 
          ? "Diskusi Laporan" 
          : (teks.trim().length > 35 ? teks.trim().slice(0, 32) + "..." : teks.trim());
        const newSession = await prisma.sesiObrolan.create({
          data: {
            judul_sesi: autoTitle,
            id_pengguna: activeUser.id,
            id_laporan: id_laporan || null
          }
        });
        activeSessionId = newSession.id_sesi_obrolan;
      }

      // 7. Simpan pesan pengguna (pengirim: "USER")
      await prisma.pesanObrolan.create({
        data: {
          id_sesi_obrolan: activeSessionId,
          pengirim: "USER",
          teks
        }
      });

      // 8. Update tanggal diperbarui sesi obrolan
      await prisma.sesiObrolan.update({
        where: { id_sesi_obrolan: activeSessionId },
        data: { tanggal_diperbarui: new Date() }
      });

      // 8.5. Pemeriksaan Guardrail Domain & Privasi Data Pengguna
      const domainViolation = checkOutOfDomainSecurity(teks);
      if (domainViolation) {
        const aiMessage = await prisma.pesanObrolan.create({
          data: {
            id_sesi_obrolan: activeSessionId,
            pengirim: "AI",
            teks: domainViolation
          }
        });

        await prisma.penggunaanChatbot.update({
          where: { id_penggunaan_chatbot: penggunaan.id_penggunaan_chatbot },
          data: { jumlah: penggunaan.jumlah + 1 }
        });

        return {
          response: domainViolation,
          id_pesan: aiMessage.id_pesan_obrolan,
          id_sesi_obrolan: activeSessionId,
          tokens: 0
        };
      }

      // 9. Handshake ke FastAPI AI Service
      let aiTeks = "Sistem gagal mendapatkan respons dari AI Service.";
      const token = await generateServiceToken({
        userId: activeUser.id,
        role: peran || "ASLAB",
        scope: "chatbot"
      });

      try {
        const response = await fetch(`${CONFIG.FASTAPI_SERVICE_URL}/api/v1/chatbot/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            message: teks,
            id_laporan: id_laporan || null,
            role: peran || "ASLAB"
          }),
          signal: AbortSignal.timeout(25000)
        });

        if (response.ok) {
          const data = await response.json() as any;
          aiTeks = data.response || data.text || aiTeks;
        } else {
          const errorText = await response.text();
          try {
            const errJson = JSON.parse(errorText);
            aiTeks = errJson.detail || errJson.message || `[Error AI Service]: ${errorText}`;
          } catch {
            aiTeks = `[Error AI Service]: ${errorText}`;
          }
        }
      } catch (err: any) {
        // Fallback respons lokal jika AI Service offline (untuk keperluan pengembangan/unit testing)
        aiTeks = `Halo, saya adalah asisten akademik STITEK Bontang. Pertanyaan: "${teks}". AI Service tidak merespons: ${err.message}`;
      }

      // 10. Simpan respons AI (pengirim: "AI")
      const aiMessage = await prisma.pesanObrolan.create({
        data: {
          id_sesi_obrolan: activeSessionId,
          pengirim: "AI",
          teks: aiTeks
        }
      });

      // 11. Tingkatkan counter penggunaan chatbot
      await prisma.penggunaanChatbot.update({
        where: { id_penggunaan_chatbot: penggunaan.id_penggunaan_chatbot },
        data: { jumlah: penggunaan.jumlah + 1 }
      });

      return {
        ...aiMessage,
        id_sesi_obrolan: activeSessionId
      };
    },
    {
      beforeHandle: checkAbility("create", "Chatbot"),
      body: t.Object({
        id_sesi_obrolan: t.Optional(t.Nullable(t.String())),
        teks: t.String(),
        id_laporan: t.Optional(t.Nullable(t.String()))
      })
    }
  );
