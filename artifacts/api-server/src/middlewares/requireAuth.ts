import { createMiddleware } from 'hono/factory'
import { getAuth } from '@hono/clerk-auth'

type Env = {
  Variables: {
    userId: string
  }
}

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const auth = getAuth(c)
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  c.set('userId', auth.userId)
  await next()
})
