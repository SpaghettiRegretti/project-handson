import { createClient } from "@supabase/supabase-js";
import { createClient as createRedisClient } from "redis";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);
const redis = createRedisClient({ url: process.env.REDIS_URL });

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID parameter is missing" });

  try {
    if (!redis.isOpen) await redis.connect();

    const cacheKey = `detail_seni_${id}`;

    // Cek cache Redis spesifik per ID gambar
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return res
        .status(200)
        .json({ source: "REDIS", data: JSON.parse(cachedData) });
    }

    // Ambil detail spesifik dari tabel koleksi berdasarkan ID
    const { data, error } = await supabase
      .from("koleksi")
      .select("pencipta, tahun, harga")
      .eq("id", id)
      .single();
    if (error) throw error;

    // Simpan di Redis selama 60 detik
    await redis.setEx(cacheKey, 60, JSON.stringify(data));

    return res.status(200).json({ source: "SUPABASE", data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  } finally {
    if (redis.isOpen) await redis.quit();
  }
}
