let qrData = null;
let qrString = null;
let connectionStatus = 'disconnected';
let qrCallbacks = [];

export function setQR(dataUrl, rawString) {
  qrData = dataUrl;
  qrString = rawString;
  qrCallbacks.forEach(cb => cb(dataUrl));
}

export function getQR() {
  return qrData;
}

export function getQRString() {
  return qrString;
}

export function setConnectionStatus(status) {
  connectionStatus = status;
}

export function getConnectionStatus() {
  return connectionStatus;
}

export function onQR(callback) {
  qrCallbacks.push(callback);
  return () => {
    qrCallbacks = qrCallbacks.filter(cb => cb !== callback);
  };
}
