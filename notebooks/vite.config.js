export default {
  build: {
    sourcemap: true,
  },
  // host: true binds the preview dev server to 0.0.0.0 so it's reachable
  // from other devices on the local network, not just localhost.
  // The port is pinned so the firewall rule below always matches.
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
};
