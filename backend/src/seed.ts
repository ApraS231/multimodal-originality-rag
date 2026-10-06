import { prisma } from "./db/prisma";

async function seed() {
  console.log("🌱 Memulai seeding data pengguna dummy...");

  const usersData = [
    {
      email: "admin@stitek.ac.id",
      nama: "Admin Veritas STITEK",
      password: "PasswordAdmin123!",
      role: "ADMIN",
      profil: {
        kode_aslab: null,
        kode_kalab: null,
        nim: null
      }
    },
    {
      email: "alvin.aslab@stitek.ac.id",
      nama: "Alvin Pratama (Asisten Lab)",
      password: "PasswordAslab123!",
      role: "ASLAB",
      profil: {
        kode_aslab: "ASLAB-001",
        kode_kalab: null,
        nim: "2201001"
      }
    },
    {
      email: "gibson.kalab@stitek.ac.id",
      nama: "Dr. Gibson (Kepala Lab)",
      password: "PasswordKalab123!",
      role: "KEPALA_LAB",
      profil: {
        kode_aslab: null,
        kode_kalab: "KALAB-001",
        nim: null
      }
    }
  ];

  for (const item of usersData) {
    const hashedPassword = await Bun.password.hash(item.password);

    // Cari apakah pengguna sudah ada
    const existingUser = await prisma.pengguna.findUnique({
      where: { email: item.email },
      include: { profil: true }
    });

    if (existingUser) {
      console.log(`🔄 Mengabaikan/Memperbarui pengguna: ${item.email}`);
      // Update kata sandi & nama
      await prisma.pengguna.update({
        where: { id: existingUser.id },
        data: {
          nama: item.nama,
          kata_sandi: hashedPassword,
          profil: {
            upsert: {
              create: {
                peran: item.role,
                nim: item.profil.nim,
                kode_aslab: item.profil.kode_aslab,
                kode_kalab: item.profil.kode_kalab
              },
              update: {
                peran: item.role,
                nim: item.profil.nim,
                kode_aslab: item.profil.kode_aslab,
                kode_kalab: item.profil.kode_kalab
              }
            }
          }
        }
      });
    } else {
      console.log(`✨ Membuat pengguna baru: ${item.email} (${item.role})`);
      await prisma.pengguna.create({
        data: {
          email: item.email,
          nama: item.nama,
          kata_sandi: hashedPassword,
          profil: {
            create: {
              peran: item.role,
              nim: item.profil.nim,
              kode_aslab: item.profil.kode_aslab,
              kode_kalab: item.profil.kode_kalab
            }
          }
        }
      });
    }
  }

  console.log("✅ Seeding selesai sukses!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Gagal melakukan seeding:", err);
  process.exit(1);
});
