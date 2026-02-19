// ManyACG 图片源
export const ManyACGSource = {
  name: "ManyACG",
  url: "https://manyacg.top/api/__api_party/acgapi",
  headers: {
    "accept": "application/json",
    "accept-language": "zh-CN,zh;q=0.9",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "origin": "https://manyacg.top",
    "pragma": "no-cache",
    "referer": "https://manyacg.top/",
    "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
  },

  async fetch(page: number = 1, limit: number = 10): Promise<any[]> {
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          path: "/artwork/list",
          query: {
            page: page,
            page_size: limit,
            r18: 0,
            limit: limit,
          },
          headers: [],
          method: "GET",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.status !== 200 || !result.data) {
        throw new Error("Invalid response");
      }

      return result.data.map((item: any) => ({
        id: item.id,
        url: item.pictures[0]?.regular || item.pictures[0]?.thumbnail,
        thumb: item.pictures[0]?.thumbnail,
        title: item.title,
        desc: item.description || `${item.artist.name} | ${item.source_type}`,
        author: {
          id: item.artist.id,
          name: item.artist.name,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.artist.uid}`,
          followers: Math.floor(Math.random() * 10000),
        },
        likes: item.like_count || Math.floor(Math.random() * 5000) + 100,
        views: Math.floor(Math.random() * 50000) + 1000,
        comments: Math.floor(Math.random() * 200),
        tags: item.tags.slice(0, 5),
        createdAt: item.created_at.split(" ")[0],
        source: "manyacg",
        sourceUrl: item.source_url,
        r18: item.r18,
      }));
    } catch (error) {
      console.error("获取 ManyACG 图片失败:", error);
      return [];
    }
  },
};
