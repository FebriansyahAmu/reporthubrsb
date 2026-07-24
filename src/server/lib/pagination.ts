export type PageParams = { page: number; pageSize: number };
export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function toOffset({ page, pageSize }: PageParams) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

export function buildMeta(p: PageParams, total: number): PageMeta {
  return { ...p, total, totalPages: Math.max(1, Math.ceil(total / p.pageSize)) };
}
