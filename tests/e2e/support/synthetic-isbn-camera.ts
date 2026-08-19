import type { BrowserContext } from '@playwright/test';

const LEFT_ODD = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
] as const;

const LEFT_EVEN = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
] as const;

const RIGHT = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
] as const;

const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
] as const;

function assertValidEan13(isbn: string) {
  if (!/^\d{13}$/.test(isbn)) {
    throw new Error(`Synthetic ISBN must contain 13 digits: ${isbn}`);
  }

  const digits = [...isbn].map(Number);
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => {
      return total + digit * (index % 2 === 0 ? 1 : 3);
    }, 0);
  const checkDigit = (10 - (sum % 10)) % 10;

  if (checkDigit !== digits[12]) {
    throw new Error(`Synthetic ISBN has an invalid EAN-13 check digit: ${isbn}`);
  }
}

function encodeEan13(isbn: string): string {
  assertValidEan13(isbn);
  const digits = [...isbn].map(Number);
  const parity = PARITY[digits[0]];
  const left = digits
    .slice(1, 7)
    .map((digit, index) => {
      return parity[index] === 'L' ? LEFT_ODD[digit] : LEFT_EVEN[digit];
    })
    .join('');
  const right = digits
    .slice(7)
    .map((digit) => RIGHT[digit])
    .join('');

  return `101${left}01010${right}101`;
}

/**
 * 実カメラを使わず、video要素から有効なEAN-13が来たようにCanvasへ描画する。
 * アプリ側のZXing解析と「2回連続検出」の処理は実物をそのまま通る。
 */
export async function installSyntheticIsbnCamera(
  context: BrowserContext,
  isbn: string
) {
  const bits = encodeEan13(isbn);

  await context.addInitScript(({ barcodeBits }) => {
    const mediaDevices = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => new MediaStream(),
    });
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: mediaDevices,
      });
    }

    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => HTMLMediaElement.HAVE_ENOUGH_DATA,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get: () => 960,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get: () => 540,
    });
    HTMLMediaElement.prototype.play = async () => undefined;

    const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
    const syntheticDrawImage = function (
      this: CanvasRenderingContext2D,
      ...args: unknown[]
    ) {
      const source = args[0];
      if (!(source instanceof HTMLVideoElement)) {
        return Reflect.apply(originalDrawImage, this, args);
      }

      const width = this.canvas.width;
      const height = this.canvas.height;
      const quietZoneModules = 12;
      const totalModules = barcodeBits.length + quietZoneModules * 2;
      const moduleWidth = Math.max(2, Math.floor(width / totalModules));
      const barcodeWidth = barcodeBits.length * moduleWidth;
      const startX = Math.floor((width - barcodeWidth) / 2);

      this.save();
      this.fillStyle = '#ffffff';
      this.fillRect(0, 0, width, height);
      this.fillStyle = '#000000';
      for (let index = 0; index < barcodeBits.length; index += 1) {
        if (barcodeBits[index] === '1') {
          this.fillRect(startX + index * moduleWidth, 0, moduleWidth, height);
        }
      }
      this.restore();
    };

    CanvasRenderingContext2D.prototype.drawImage =
      syntheticDrawImage as typeof originalDrawImage;
  }, { barcodeBits: bits });
}
