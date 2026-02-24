"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ScanRect = {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
};

type OverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ISBNImportModalProps = {
  open: boolean;
  onClose: () => void;
  onDetected: (isbn: string) => void | Promise<void>;
};

const ISBN13_REGEX = /^97[89]\d{10}$/;
const SCAN_INTERVAL_MS = 45;
//横枠比率
const SCAN_WIDTH_RATIO = 0.65;
//縦枠比率
const SCAN_HEIGHT_RATIO = 0.14;
const SCAN_MIN_WIDTH = 320;
const SCAN_MIN_HEIGHT = 90;

// カメラの真ん中を読む範囲を作る。
function getScanRect(videoWidth: number, videoHeight: number): ScanRect {
  const sourceWidth = Math.min(
    videoWidth,
    Math.max(SCAN_MIN_WIDTH, Math.floor(videoWidth * SCAN_WIDTH_RATIO))
  );
  const sourceHeight = Math.min(
    videoHeight,
    Math.max(SCAN_MIN_HEIGHT, Math.floor(videoHeight * SCAN_HEIGHT_RATIO))
  );
  const sourceX = Math.floor((videoWidth - sourceWidth) / 2);
  const sourceY = Math.floor((videoHeight - sourceHeight) / 2);
  return { sourceX, sourceY, sourceWidth, sourceHeight };
}

// object-coverのズレを計算して、枠の位置を合わせる。
function getOverlayRect(video: HTMLVideoElement, scanRect: ScanRect): OverlayRect | null {
  const elementWidth = video.clientWidth;
  const elementHeight = video.clientHeight;
  const sourceVideoWidth = video.videoWidth;
  const sourceVideoHeight = video.videoHeight;
  if (
    elementWidth <= 0 ||
    elementHeight <= 0 ||
    sourceVideoWidth <= 0 ||
    sourceVideoHeight <= 0
  ) {
    return null;
  }

  const scale = Math.max(
    elementWidth / sourceVideoWidth,
    elementHeight / sourceVideoHeight
  );
  const renderedWidth = sourceVideoWidth * scale;
  const renderedHeight = sourceVideoHeight * scale;
  const offsetX = (elementWidth - renderedWidth) / 2;
  const offsetY = (elementHeight - renderedHeight) / 2;

  return {
    left: offsetX + scanRect.sourceX * scale,
    top: offsetY + scanRect.sourceY * scale,
    width: scanRect.sourceWidth * scale,
    height: scanRect.sourceHeight * scale,
  };
}

export default function ISBNImportModal({
  open,
  onClose,
  onDetected,
}: ISBNImportModalProps) {
  // 親から来た関数を最新のまま使う。
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCloseRef = useRef(onClose);
  const onDetectedRef = useRef(onDetected);
  const detectingRef = useRef(false);
  const [overlayRect, setOverlayRect] = useState<OverlayRect | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  // モーダルが開いてる間だけカメラを動かす。
  useEffect(() => {
    if (!open || !videoRef.current) return;

    detectingRef.current = false;
    let active = true;
    let stream: MediaStream | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let resizeBound = false;
    //ISBNだけ読む設定
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
    const reader = new BrowserMultiFormatReader(hints);
    const scanCanvas = document.createElement("canvas");
    const scanContext = scanCanvas.getContext("2d", { willReadFrequently: true });

    // 画面サイズ変更時に、video表示サイズに合わせてスキャン枠の位置・サイズを再計算する
    const updateOverlayRect = () => {
      const video = videoRef.current;
      if (!video) return;
      const next = getOverlayRect(video, getScanRect(video.videoWidth, video.videoHeight));
      if (next) setOverlayRect(next);
    };

    // タイマーとカメラをちゃんと止める。
    const clearResources = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (resizeBound) {
        window.removeEventListener("resize", updateOverlayRect);
        resizeBound = false;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setOverlayRect(null);
    };

    // フレームを回しながらISBNを探す。
    const scanFrame = () => {
      if (!active || detectingRef.current || !videoRef.current || !scanContext) return;

      const video = videoRef.current;
      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
      ) {
        timerId = setTimeout(scanFrame, SCAN_INTERVAL_MS);
        return;
      }

      // 真ん中の帯だけ切り出して読む。
      const scanRect = getScanRect(video.videoWidth, video.videoHeight);
      scanCanvas.width = scanRect.sourceWidth;
      scanCanvas.height = scanRect.sourceHeight;
      scanContext.drawImage(
        video,
        scanRect.sourceX,
        scanRect.sourceY,
        scanRect.sourceWidth,
        scanRect.sourceHeight,
        0,
        0,
        scanRect.sourceWidth,
        scanRect.sourceHeight
      );

      try {
        const result = reader.decodeFromCanvas(scanCanvas);
        const isbn = result.getText().trim();
        if (!ISBN13_REGEX.test(isbn)) {
          // ISBN(978/979)じゃなければスキップ。
          timerId = setTimeout(scanFrame, SCAN_INTERVAL_MS);
          return;
        }

        detectingRef.current = true;
        clearResources();
        onCloseRef.current();
        void Promise.resolve(onDetectedRef.current(isbn)).finally(() => {
          detectingRef.current = false;
        });
        return;
      } catch {
        // 読めなかったら次フレームで再挑戦。
      }

      timerId = setTimeout(scanFrame, SCAN_INTERVAL_MS);
    };

    // 背面カメラ優先で起動して、準備できたら読み取り開始。
    const startCamera = async () => {
      setCameraError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 960 },
            height: { ideal: 540 },
          },
          audio: false,
        });
        if (!active || !videoRef.current) {
          clearResources();
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        updateOverlayRect();
        window.addEventListener("resize", updateOverlayRect);
        resizeBound = true;
        scanFrame();
      } catch {
        if (!active) return;
        setCameraError("カメラの起動に失敗しました");
      }
    };

    void startCamera();

    return () => {
      active = false;
      clearResources();
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" />
      {overlayRect && (
        <div
          className="pointer-events-none absolute rounded border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          style={{
            left: `${overlayRect.left}px`,
            top: `${overlayRect.top}px`,
            width: `${overlayRect.width}px`,
            height: `${overlayRect.height}px`,
          }}
        />
      )}
      <div className="absolute bottom-0 w-full bg-black/70 p-4 text-white">
        <p className="mb-3 text-sm">ISBN(978/979)バーコードを枠に合わせてください</p>
        {cameraError && <p className="mb-3 text-sm text-red-300">{cameraError}</p>}
        <button
          type="button"
          onClick={() => onCloseRef.current()}
          className="rounded bg-white px-4 py-2 text-zinc-900"
        >
          閉じる
        </button>
      </div>
    </div>,
    document.body
  );
}
