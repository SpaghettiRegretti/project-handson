import { createClient } from "@supabase/supabase-js";
import { createClient as createRedisClient } from "redis";

// Koneksi ke Supabase dan Redis menggunakan Environment Variables
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);
const redis = createRedisClient({ url: process.env.REDIS_URL });

export default async function handler(req, res) {
  try {
    if (!redis.isOpen) await redis.connect();

    // 1. Cek data di cache Redis terlebih dahulu
    const cachedData = await redis.get("koleksi_katalog");
    if (cachedData) {
      return res
        .status(200)
        .json({ source: "REDIS", data: JSON.parse(cachedData) });
    }

    // 2. Jika cache kosong, ambil dari database Supabase
    // Kita hanya mengambil id, judul, dan path untuk katalog awal
    const { data, error } = await supabase
      .from("koleksi")
      .select("id, judul, path");
    if (error) throw error;

    // 3. Simpan hasil dari Supabase ke Redis (Kita set durasi 60 detik)
    await redis.setEx("koleksi_katalog", 60, JSON.stringify(data));

    return res.status(200).json({ source: "SUPABASE", data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  } finally {
    if (redis.isOpen) await redis.quit(); // Tutup koneksi agar resource tidak menggantung
  }
}
