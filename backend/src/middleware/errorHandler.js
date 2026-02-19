const isProd = process.env.NODE_ENV === 'production'

export function errorHandler(err, _req, res, _next) {
  console.error(err)
  const status = err.status ?? err.statusCode ?? 500
  // Never leak internal details to the client in production
  const message = (!isProd || status < 500)
    ? (err.message || 'Internal server error')
    : 'Internal server error'
  res.status(status).json({ error: message })
}
