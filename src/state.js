import qrcode from 'qrcode';

let qrData = null;
let qrString = null;
let connectionStatus = 'disconnected';
let qrCallbacks = [];

export function setQR(rawString) {
  qrString = rawString;
  qrcode.toDataURL(rawString, { width: 400, margin: 2 }).then(url => {
    qrData = url;
    qrCallbacks.forEach(cb => cb(url));
  }).catch(() => {});
}

export function clearQR() {
  qrData = null;
  qrString = null;
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
