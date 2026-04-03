const ok = (res, data = null, message = 'Success', status = 200) =>
  res.status(status).json({ success: true, message, data });

const created = (res, data = null, message = 'Created') =>
  res.status(201).json({ success: true, message, data });

const fail = (res, message = 'Something went wrong', status = 400, error = null) =>
  res.status(status).json({ success: false, message, ...(error && { error }) });

const paginated = (res, data, total, page, limit) =>
  res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  });

module.exports = { ok, created, fail, paginated };
