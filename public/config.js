window.ZORTLORANT_SERVER_URL = location.protocol === 'https:'
  ? 'wss://' + location.host + '/api/ws'
  : '';
