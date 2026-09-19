import { feathers } from '@feathersjs/feathers'
import type { RealTimeConnection } from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio'
import { memory } from '@feathersjs/memory'
import socketioClient from '@feathersjs/socketio-client'
import { io, type Socket } from 'socket.io-client'

/**
 * A `messages` service over socket.io with two clients connected to it, and
 * every message each of them received.
 *
 * The payload of a channel is only ever read in the socket dispatcher, so a
 * publisher that silently drops it looks perfectly fine from the outside. That
 * is what these need real sockets for.
 *
 * `.fixture.ts` keeps it out of the published package and out of coverage,
 * while `src/` keeps it inside the `rootDir` its callers live in.
 */
export async function connectTwo() {
  const app = feathers()

  app.configure(socketio())
  app.use('messages', memory())

  const connections: RealTimeConnection[] = []
  app.on('connection', (connection: RealTimeConnection) =>
    connections.push(connection),
  )

  const server = await app.listen(0)

  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve))
  }

  const address = server.address()

  if (typeof address !== 'object' || address === null) {
    throw new Error('expected the server to be listening on a port')
  }

  const { port } = address
  const received: Record<'a' | 'b', any[]> = { a: [], b: [] }
  const sockets: Socket[] = []

  // one at a time, so the two server-side connections can be told apart
  for (const key of ['a', 'b'] as const) {
    const socket = io(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    })

    sockets.push(socket)

    // `.default`, because the package is CommonJS: from ESM the default import
    // is its `module.exports`, not the function on it. And the cast, because it
    // types the socket from the CJS build of `socket.io-client` while an ESM
    // importer gets the ESM one - the same class twice, nominally distinct.
    const client = feathers().configure(
      socketioClient.default(
        socket as unknown as Parameters<typeof socketioClient.default>[0],
      ),
    )

    client.service('messages').on('created', (message: any) => {
      received[key].push(message)
    })

    await vi.waitUntil(() => connections.length === sockets.length)
  }

  return {
    app,
    received,
    a: connections[0],
    b: connections[1],
    /** Creates a message, without waiting for anything to arrive. */
    async createOnly(data: any) {
      await app.service('messages').create(data)
    },
    /** Creates a message and waits until both clients have one more. */
    async create(data: any) {
      const before = { a: received.a.length, b: received.b.length }

      await app.service('messages').create(data)
      await vi.waitUntil(
        () => received.a.length > before.a && received.b.length > before.b,
      )
    },
    async close() {
      sockets.forEach((socket) => socket.disconnect())
      await new Promise((resolve) => server.close(resolve))
    },
  }
}
