const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, aiVoice: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/tts", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Metin gerekli." });
    if (text.length > 4096) return res.status(400).json({ error: "Metin çok uzun." });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "Doğal yapay zekâ sesi henüz etkin değil." });
    }

    const makeSpeech = async (model) => fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        voice: process.env.OPENAI_TTS_VOICE || "marin",
        input: text,
        instructions:
          "Türkçe konuş. Ortaokul öğrencisine ders anlatan sabırlı, sıcak ve doğal bir matematik öğretmeni gibi konuş. " +
          "Robotik olma. Sayıları, matematik işlemlerini ve noktalama işaretlerini anlaşılır biçimde oku. " +
          "Tempon sakin ama sıkıcı olmayacak kadar canlı olsun.",
        response_format: "mp3"
      })
    });

    // Önce güncel önerilen Realtime Mini modelini dene.
    let response = await makeSpeech(process.env.OPENAI_TTS_MODEL || "gpt-realtime-2.1-mini");

    // Hesap/endpoint henüz bu modeli speech endpointinde kabul etmiyorsa geçici uyumluluk geri dönüşü.
    if (!response.ok && !process.env.OPENAI_TTS_MODEL) {
      const firstDetail = await response.text();
      console.warn("Primary voice model unavailable, trying compatibility model:", response.status, firstDetail);
      response = await makeSpeech("gpt-4o-mini-tts");
    }

    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI TTS error:", response.status, detail);
      return res.status(502).json({ error: "Ses üretilemedi." });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.set({
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600"
    });
    res.send(audio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Öykü Matematik ${port} portunda çalışıyor.`));
