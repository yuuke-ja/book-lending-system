"use client";

import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { FC, useEffect, useRef, useState } from "react";
type PendingBook = {
  id: string;
  title: string;
  authors: string[];
  isbn13: string;
  thumbnail?: string | null;
  description?: string | null;
};

const QRCodeReader: FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const fetchingRef = useRef(false); // ★ 429対策

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<any>(null);
  const [pending, setPending] = useState<PendingBook[]>([]);

  const ISBN13_REGEX = /^97[89]\d{10}$/;

  useEffect(() => {
    fetch("/api/book/pendingbook", { method: "GET" })
      .then((res) => res.json())
      .then((data) => setPending(data))
      .catch(() => setPending([]));

  }, []);

  useEffect(() => {
    if (!isActive || !videoRef.current) return;

    let active = true;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(
        undefined,
        videoRef.current,
        async (result, scanError) => {
          if (!active || scanError || !result) return;

          const text = result.getText();
          console.log("SCAN:", text);

          if (!ISBN13_REGEX.test(text)) {
            setError("ISBN(978/979)のバーコードを読み取ってください");
            return;
          }

          // ★ 二重fetch防止
          if (fetchingRef.current) return;
          fetchingRef.current = true;

          // カメラ停止
          controlsRef.current?.stop();
          controlsRef.current = null;
          setIsActive(false);

          try {
            setError(null);
            const res = await fetch(`/api/qrcode/book?isbn=${text}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            const resbook = await fetch('/api/book/pendingbook', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                googleBookId: data.googleBookId,
                isbn13: data.isbn13,
                title: data.title,
                authors: data.authors,
                description: data.description,
                thumbnail: data.thumbnail
              })
            });
            if (!resbook.ok) throw new Error();
            const saved = await resbook.json();
            setPending((prev) => [saved, ...prev]);
          } catch (error) {
            setError("本の情報を取得できませんでした");
          } finally {
            fetchingRef.current = false;
          }
        }
      )
      .then((controls) => {
        if (!active) return;
        controlsRef.current = controls;
      })
      .catch(() => {
        if (!active) return;
        setError("カメラの起動に失敗しました");
      });

    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isActive]);
  function pendingdelete(id: number) {
    fetch('/api/book/pendingbook', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id })
    }).then(res => {
      if (!res.ok) throw new Error()
      setPending((prev) => prev.filter(pb => pb.id !== id))
    })
  }
  function Bookregistration() {
    fetch('/api/book/book-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
    }).then(res => {
      if (!res.ok) throw new Error()
      setPending([])
    })
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={() => {
          fetchingRef.current = false; // ★ リセット
          setError(null);
          setBook(null);
          setIsActive(true);
        }}
        className="rounded-md bg-black px-4 py-2 text-white"
      >
        QRコードを読み取る
      </button>
      <button className="rounded-md bg-green-600 px-4 py-2 text-white" onClick={() => Bookregistration()}>登録</button>

      {pending.length > 0 && (
        <div className="mt-6 space-y-2">
          {pending.map((pb) => (
            <div key={pb.isbn13} className="rounded border p-2">
              <p className="font-semibold">{pb.title}</p>
              <div className="flex items-center justify-between">
                {pb.thumbnail && <img src={pb.thumbnail} className="mt-2 w-32" />}
                {pb.description && <p className="text-sm text-zinc-600 px-4 ">{pb.description}</p>}
                <button className="mt-2 rounded bg-red-500 px-2 py-1 text-xs text-white" onClick={() => pendingdelete(pb.id)}>削除</button>
              </div>
              {pb.authors?.length > 0 && (
                <p className="text-sm text-zinc-600">
                  {pb.authors.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}


      {error && <p className="text-sm text-red-600">{error}</p>}

      {isActive && (
        <div className="fixed inset-0 z-50 bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" />
          <div className="absolute bottom-0 w-full bg-black/70 p-4">
            <button
              onClick={() => {
                controlsRef.current?.stop();
                controlsRef.current = null;
                setIsActive(false);
              }}
              className="rounded bg-white px-4 py-2"
            >
              戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeReader;
