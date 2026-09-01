export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type ApiOptions = RequestInit & { skipAuthRedirect?: boolean }

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { skipAuthRedirect, ...fetchOpts } = options
  const headers = new Headers(fetchOpts.headers)
  const isForm = typeof FormData !== 'undefined' && fetchOpts.body instanceof FormData
  if (!isForm && fetchOpts.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, {
    credentials: 'include',
    ...fetchOpts,
    headers,
  })

  if (res.status === 401) {
    if (!skipAuthRedirect && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login')
    }
    throw new ApiError(401, '未登录')
  }

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

let writeChain: Promise<void> = Promise.resolve()

export function enqueueWrite(fn: () => Promise<void>): Promise<void> {
  const run = writeChain.then(fn, fn)
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
