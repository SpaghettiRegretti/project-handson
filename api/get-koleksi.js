import { createClient } from "@supabase/supabase-js";
import { createClient as createRedisClient } from "redis";

// Ubah menjadi NEXT_PUBLIC_... sesuai dengan isi .env.local Anda
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

// Untuk Redis, kita tambahkan fallback (opsi) jika namanya KV_URL
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
const redis = createRedisClient({ url: redisUrl });

export default async function handler(req, res) {
  try {
    if (!redisUrl) throw new Error("Redis URL tidak ditemukan di env!");
    if (!redis.isOpen) await redis.connect();

    // Cek cache Redis (kunci: katalog_seni)
    const cachedData = await redis.get("katalog_seni");
    if (cachedData) {
      return res
        .status(200)
        .json({ source: "REDIS", data: JSON.parse(cachedData) });
    }

    // Jika tidak ada di cache, ambil dari tabel koleksi
    const { data, error } = await supabase
      .from("koleksi")
      .select("id, judul, path");
    if (error) throw error;

    // Simpan ke Redis selama 60 detik
    await redis.setEx("katalog_seni", 60, JSON.stringify(data));

    return res.status(200).json({ source: "SUPABASE", data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  } finally {
    if (redis.isOpen) await redis.quit();
  }
}
