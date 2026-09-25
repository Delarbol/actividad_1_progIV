exports.success = (res, data, status = 200) => res.status(status).json({ data });
exports.error = (res, status, message, details) => res.status(status).json({
  error: { message, ...(details && { details }) },
});
