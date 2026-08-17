// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ISBNImportModal from "@/app/_components/ISBNImportModal";

const mocks = vi.hoisted(() => ({
  decodeFromCanvas: vi.fn(),
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class BrowserMultiFormatReader {
    decodeFromCanvas = mocks.decodeFromCanvas;
  },
}));

vi.mock("@zxing/library", () => ({
  BarcodeFormat: { EAN_13: "EAN_13" },
  DecodeHintType: { POSSIBLE_FORMATS: "POSSIBLE_FORMATS" },
}));

function decoded(text: string) {
  return { getText: () => text };
}

describe("ISBNImportModal", () => {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
  const getUserMedia = vi.fn();
  const play = vi.fn();
  const drawImage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getUserMedia.mockResolvedValue(stream);
    play.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperties(HTMLVideoElement.prototype, {
      play: { configurable: true, value: play },
      readyState: { configurable: true, get: () => 4 },
      videoWidth: { configurable: true, get: () => 960 },
      videoHeight: { configurable: true, get: () => 540 },
      clientWidth: { configurable: true, get: () => 480 },
      clientHeight: { configurable: true, get: () => 720 },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({ drawImage }) as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("閉じている時はカメラを起動しない", () => {
    render(
      <ISBNImportModal open={false} onClose={vi.fn()} onDetected={vi.fn()} />
    );

    expect(screen.queryByText(/ISBN\/JANコードを枠/)).not.toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("背面カメラ優先で起動し、閉じるとtrackとvideoを解放する", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const view = render(
      <ISBNImportModal open onClose={onClose} onDetected={vi.fn()} />
    );

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 960 },
        height: { ideal: 540 },
      },
      audio: false,
    });
    expect(play).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(
      <ISBNImportModal open={false} onClose={onClose} onDetected={vi.fn()} />
    );
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("カメラ起動に失敗した時はエラーを表示する", async () => {
    getUserMedia.mockRejectedValueOnce(new Error("permission denied"));
    render(<ISBNImportModal open onClose={vi.fn()} onDetected={vi.fn()} />);

    expect(
      await screen.findByText("カメラの起動に失敗しました")
    ).toBeInTheDocument();
  });

  it("同じ有効ISBNを2回連続で読んだ時だけ検出を確定する", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onDetected = vi.fn();
    mocks.decodeFromCanvas
      .mockReturnValueOnce(decoded("1234567890123"))
      .mockReturnValueOnce(decoded("9781234567890"))
      .mockReturnValueOnce(decoded("9781234567890"));

    render(
      <ISBNImportModal open onClose={onClose} onDetected={onDetected} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onDetected).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(45);
    });
    expect(onDetected).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(45);
      await Promise.resolve();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith("9781234567890");
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("連続するISBNが変わった場合は候補回数をリセットする", async () => {
    vi.useFakeTimers();
    const onDetected = vi.fn();
    mocks.decodeFromCanvas
      .mockReturnValueOnce(decoded("9781234567890"))
      .mockReturnValueOnce(decoded("9780000000001"))
      .mockReturnValueOnce(decoded("9780000000001"));

    render(
      <ISBNImportModal open onClose={vi.fn()} onDetected={onDetected} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45);
    });
    expect(onDetected).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45);
    });
    expect(onDetected).toHaveBeenCalledWith("9780000000001");
  });

  it("画面破棄時にtimer・camera track・video srcObjectを解放する", async () => {
    vi.useFakeTimers();
    mocks.decodeFromCanvas.mockImplementation(() => {
      throw new Error("not detected");
    });
    const view = render(
      <ISBNImportModal open onClose={vi.fn()} onDetected={vi.fn()} />
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const video = view.container.ownerDocument.querySelector("video");
    expect(video?.srcObject).toBe(stream);
    const callsBeforeUnmount = mocks.decodeFromCanvas.mock.calls.length;

    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video?.srcObject).toBeNull();

    act(() => vi.advanceTimersByTime(1000));
    expect(mocks.decodeFromCanvas).toHaveBeenCalledTimes(callsBeforeUnmount);
  });
});
