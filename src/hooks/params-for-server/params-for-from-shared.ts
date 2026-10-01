/**
 * This is the default key that is used to store the client params in the server params.
 * It is exported so that it can be used in other hooks that need to access the client params.
 *
 * @see https://utils.feathersjs.com/hooks/params-for-server.html
 */
export const FROM_CLIENT_FOR_SERVER_DEFAULT_KEY = '_$client' as const
