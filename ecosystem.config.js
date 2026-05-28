/** @type {import('pm2').StartOptions[]} */
const apps = [
  {
    name: "queue-nextjs",
    cwd: __dirname,
    script: "npm",
    args: "start",
    env: {
      NODE_ENV: "production"
    }
  },
  {
    name: "queue-socket",
    cwd: __dirname,
    script: "socket-server.js",
    env: {
      NODE_ENV: "production",
      SOCKET_SERVER_PORT: 4010
    }
  }
]

module.exports = { apps }
