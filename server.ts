import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/deno";
import { getSource, getAvailableSources } from "./sources/index.ts";
import { CacheDB } from "./db/kv.ts";

const app = new Hono();

// 启用 CORS
app.use("/*", cors());

// 内存缓存（用于临时存储）
const cachedImageData: Record<string, any> = {};
const comments: Record<string, any[]> = {};

// 获取图片列表
app.get("/api/images", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const sourceName = c.req.query("source") || "manyacg";

  console.log(`[${new Date().toISOString()}] GET /api/images - page: ${page}, limit: ${limit}, source: ${sourceName}`);

  const source = getSource(sourceName);
  let images: any[] = [];

  if (sourceName === "sion") {
    images = await source.fetchMultiple(limit);
  } else {
    images = await source.fetch(page, limit);
  }

  // 保存图片数据到缓存存储
  images.forEach((img) => {
    cachedImageData[img.id] = img;
  });

  // 检查缓存状态（从 KV 查询）
  for (const img of images) {
    img.isCached = await CacheDB.has(img.id);
    img.likes = await CacheDB.getLikes(img.id);
  }

  console.log(`[${new Date().toISOString()}] 返回 ${images.length} 张图片`);

  return c.json({
    images,
    hasMore: images.length === limit,
    total: 9999,
  });
});

// 获取单张图片
app.get("/api/images/:id", async (c) => {
  const id = c.req.param("id");
  const sourceName = c.req.query("source") || "manyacg";

  const source = getSource(sourceName);
  let img: any = null;

  if (sourceName === "sion") {
    img = await source.fetch();
  }

  if (!img) {
    return c.json({ error: "获取图片失败" }, 500);
  }

  img.isCached = await CacheDB.has(id);

  return c.json(img);
});

// 缓存/点赞图片
app.post("/api/images/:id/cache", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const imageData = body.imageData;
  const isCached = await CacheDB.has(id);

  console.log(`[${new Date().toISOString()}] POST /api/images/${id}/cache - 当前状态: ${isCached ? '已缓存' : '未缓存'}`);

  let likes = await CacheDB.getLikes(id);

  if (isCached) {
    // 取消缓存
    await CacheDB.remove(id);
    likes = Math.max(0, likes - 1);
    console.log(`[${new Date().toISOString()}] 取消缓存: ${id}`);
  } else {
    // 添加缓存
    if (imageData) {
      await CacheDB.add(id, imageData);
    }
    likes++;
    const count = await CacheDB.count();
    console.log(`[${new Date().toISOString()}] 添加缓存: ${id}, 缓存总数: ${count}`);
  }

  // 保存点赞数
  await CacheDB.setLikes(id, likes);

  return c.json({
    id,
    isCached: !isCached,
    likes,
  });
});

// 获取缓存的图片列表（分页）
app.get("/api/cached", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");

  console.log(`[${new Date().toISOString()}] GET /api/cached - page: ${page}, limit: ${limit}`);

  const result = await CacheDB.getList(page, limit);

  console.log(`[${new Date().toISOString()}] 返回 ${result.images.length} 张缓存图片，总计: ${result.total}`);

  return c.json({
    images: result.images,
    hasMore: page * limit < result.total,
    total: result.total,
  });
});

// 获取评论
app.get("/api/images/:id/comments", (c) => {
  const id = c.req.param("id");
  const imageComments = comments[id] || [];
  return c.json({ comments: imageComments });
});

// 添加评论
app.post("/api/images/:id/comments", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { content } = body;

  if (!content || content.trim() === "") {
    return c.json({ error: "评论内容不能为空" }, 400);
  }

  const newComment = {
    id: Date.now(),
    user: { id: 999, name: "我", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=me", followers: 0 },
    content,
    likes: 0,
    createdAt: new Date().toLocaleString("zh-CN"),
  };

  if (!comments[id]) {
    comments[id] = [];
  }
  comments[id].unshift(newComment);

  return c.json({ comment: newComment });
});

// 点赞评论
app.post("/api/comments/:id/like", (c) => {
  return c.json({ success: true });
});

// 获取所有标签
app.get("/api/tags", (c) => {
  return c.json({ tags: ["原创", "AI", "pixiv", "蔚蓝档案", "百合"] });
});

// 获取热门图片
app.get("/api/trending", async (c) => {
  const source = getSource("manyacg");
  const images = await source.fetch(1, 10);
  
  for (const img of images) {
    img.isCached = await CacheDB.has(img.id);
  }
  
  return c.json({ images });
});

// 获取可用的图片源
app.get("/api/sources", (c) => {
  return c.json({
    sources: getAvailableSources(),
    default: "manyacg",
  });
});

// 静态文件服务 - 使用 Hono 内置 serveStatic
app.use("/*", serveStatic({
  root: "./public",
  rewriteRequestPath: (path) => {
    // SPA 模式：所有路由返回 index.html
    if (path === "/" || !path.includes(".")) {
      return "/index.html";
    }
    return path;
  },
}));

const port = 8000;
console.log(`服务器运行在 http://localhost:${port}`);
console.log(`使用 Deno KV 持久化存储`);

Deno.serve({ port }, app.fetch);
