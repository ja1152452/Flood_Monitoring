const clients = new Map();

export const streamService = {
  addClient(cameraId, res) {
    if (!clients.has(cameraId)) clients.set(cameraId, new Set());
    clients.get(cameraId).add(res);

    res.on('close', () => {
      clients.get(cameraId)?.delete(res);
    });
  },

  broadcast(cameraId, event, data) {
    const subs = clients.get(cameraId);
    if (!subs?.size) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of subs) {
      res.write(payload);
    }
  },

  broadcastAll(event, data) {
    for (const subs of clients.values()) {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of subs) res.write(payload);
    }
  },
};