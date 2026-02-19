/**
 * API key middleware — protects mutating routes (POST / PATCH / DELETE).
 *
 * Set ADMIN_API_KEY in Railway env vars.
 * The frontend sends it as the X-API-Key request header.
 *
 * If ADMIN_API_KEY is not set the server starts but logs a warning; all
 * requests are allowed so local dev without the var still works.
 */
export function requireApiKey(req, res, next) {
  const configured = process.env.ADMIN_API_KEY
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      console.error('ADMIN_API_KEY not set — rejecting mutating request')
      return res.status(503).json({ error: 'Server misconfigured' })
    }
    // Dev: allow through but warn once
    return next()
  }

  const provided = req.headers['x-api-key']
  if (provided !== configured) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}
