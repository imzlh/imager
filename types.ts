// 类型定义

export interface Author {
  id: string;
  name: string;
  avatar: string;
  followers: number;
}

export interface ImageData {
  id: string;
  url: string;
  thumb?: string;
  title: string;
  desc: string;
  author: Author;
  likes: number;
  views: number;
  comments: number;
  tags: string[];
  createdAt: string;
  source: string;
  sourceUrl?: string;
  r18?: boolean;
  isCached?: boolean;
}

export interface ImageSource {
  name: string;
  fetch(page?: number, limit?: number): Promise<ImageData[]>;
  fetchMultiple?(count: number): Promise<ImageData[]>;
}
