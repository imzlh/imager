// Sion 图片源
export const SionSource = {
  name: "Sion",
  url: "https://sion.1st.moe/loli-image?r18=0",
  headers: {
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Cache-Control": "no-cache",
    "Origin": "https://1st.moe",
    "Pragma": "no-cache",
    "Referer": "https://1st.moe/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
    "Sion-Authorization": "false",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
  },

  async fetch(): Promise<any | null> {
    try {
      const response = await fetch(this.url, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        id: data.pid.toString(),
        url: data.url,
        title: data.artwork_title,
        desc: `作者: ${data.author} | ${data.ai_type === 1 ? "AI生成" : "原创"}`,
        author: {
          id: data.uid.toString(),
          name: data.author,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.uid}`,
          followers: Math.floor(Math.random() * 10000),
        },
        likes: Math.floor(Math.random() * 5000) + 100,
        views: Math.floor(Math.random() * 50000) + 1000,
        comments: Math.floor(Math.random() * 200),
        tags: ["pixiv", data.ai_type === 1 ? "AI" : "原创"],
        createdAt: new Date().toISOString().split("T")[0],
        source: "sion",
      };
    } catch (error) {
      console.error("获取 Sion 图片失败:", error);
      return null;
    }
  },

  async fetchMultiple(count: number = 5): Promise<any[]> {
    const images = [];
    for (let i = 0; i < count; i++) {
      const img = await this.fetch();
      if (img) images.push(img);
    }
    return images;
  },
};
