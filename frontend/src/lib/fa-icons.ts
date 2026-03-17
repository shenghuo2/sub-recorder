// Font Awesome 6 Free 图标库 - 从官方 metadata 生成
// 运行 `node scripts/generate-fa-icons.js` 重新生成数据

import faData from "./fa-icons-data.json";

export type FaStyle = "solid" | "regular" | "brands";

export interface FaIconData {
  name: string;
  label: string;
  terms: string[];
  categories: string[];
}

export interface FaCategory {
  id: string;
  label: string;
  count: number;
}

// 导出图标数据
export const FA_ICONS = faData.icons as {
  solid: FaIconData[];
  regular: FaIconData[];
  brands: FaIconData[];
};

// 导出分类数据
export const FA_CATEGORIES = faData.categories as FaCategory[];

// 统计信息
export const FA_STATS = faData.stats as {
  solid: number;
  regular: number;
  brands: number;
  total: number;
  categories: number;
};

// 获取图标的 CSS 类名
export function getFaClass(iconName: string, style: FaStyle = "solid"): string {
  const prefix = style === "solid" ? "fa-solid" : style === "regular" ? "fa-regular" : "fa-brands";
  // 图标名可能已经带 fa- 前缀，也可能不带
  const name = iconName.startsWith("fa-") ? iconName : `fa-${iconName}`;
  return `${prefix} ${name}`;
}

// 解析存储的图标字符串 (格式: "style:name" 或 "name")
export function parseFaIcon(stored: string | null): { name: string; style: FaStyle } | null {
  if (!stored) return null;
  if (stored.includes(":")) {
    const [style, name] = stored.split(":");
    return { name, style: style as FaStyle };
  }
  // 兼容旧格式，默认 solid
  return { name: stored, style: "solid" };
}

// 序列化图标为存储格式
export function serializeFaIcon(name: string, style: FaStyle): string {
  return `${style}:${name}`;
}

// 搜索图标
export function searchIcons(
  query: string,
  style: FaStyle | "all" = "all",
  category: string | null = null
): Array<FaIconData & { style: FaStyle }> {
  const q = query.toLowerCase().trim();
  const results: Array<FaIconData & { style: FaStyle }> = [];

  const styles: FaStyle[] = style === "all" ? ["solid", "regular", "brands"] : [style];

  for (const s of styles) {
    for (const icon of FA_ICONS[s]) {
      // 分类筛选
      if (category && !icon.categories.includes(category)) continue;

      // 搜索匹配
      if (q) {
        const matchName = icon.name.toLowerCase().includes(q);
        const matchLabel = icon.label.toLowerCase().includes(q);
        const matchTerms = icon.terms.some(t => t.toLowerCase().includes(q));
        if (!matchName && !matchLabel && !matchTerms) continue;
      }

      results.push({ ...icon, style: s });
    }
  }

  return results;
}

// 获取分类下的图标
export function getIconsByCategory(
  category: string,
  style: FaStyle | "all" = "all"
): Array<FaIconData & { style: FaStyle }> {
  return searchIcons("", style, category);
}
