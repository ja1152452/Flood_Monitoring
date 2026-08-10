export const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page  || '1',  10));
  const limit = Math.min(5000, Math.max(1, parseInt(query.limit || '20', 10)));
  return { page, limit, offset: (page - 1) * limit };
};

export const paginate = (data, total, { page, limit }) => ({
  data,
  meta: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext:    page * limit < total,
  },
});