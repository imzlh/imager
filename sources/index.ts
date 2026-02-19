// 图片源管理器
import { ManyACGSource } from "./manyacg.ts";
import { SionSource } from "./sion.ts";

// 注册所有图片源
export const ImageSources = {
  manyacg: ManyACGSource,
  sion: SionSource,
};

// 获取图片源
export function getSource(name: string) {
  return ImageSources[name as keyof typeof ImageSources] || ManyACGSource;
}

// 获取所有可用的源名称
export function getAvailableSources(): string[] {
  return Object.keys(ImageSources);
}

// 默认源
export const DefaultSource = ManyACGSource;
