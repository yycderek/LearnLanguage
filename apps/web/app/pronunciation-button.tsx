"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Gauge, Square, Volume2 } from "lucide-react";
import {
  createPronunciationRequest,
  type PronunciationSpeed,
} from "@learn-language/application/pronunciation";
import { createWebPronunciationPlayer } from "@/lib/pronunciation";
import type { AppLocale } from "@/lib/i18n";

const subscribeToPronunciationSupport = () => () => undefined;

export function PronunciationControls({
  text,
  languageId,
  locale,
}: {
  text: string;
  languageId: string;
  locale: AppLocale;
}) {
  const player = useMemo(() => createWebPronunciationPlayer(), []);
  const supported = useSyncExternalStore(subscribeToPronunciationSupport, () => player.isSupported(), () => false);
  const [speaking, setSpeaking] = useState<PronunciationSpeed>();
  const [error, setError] = useState("");
  const c = (zh: string, en: string) => locale === "zh-CN" ? zh : en;

  useEffect(() => () => { void player.stop(); }, [player]);

  const play = async (speed: PronunciationSpeed) => {
    setError("");
    if (speaking === speed) {
      await player.stop();
      setSpeaking(undefined);
      return;
    }
    try {
      const request = createPronunciationRequest(text, languageId, speed);
      await player.speak(request, {
        onStart: () => setSpeaking(speed),
        onDone: () => setSpeaking(undefined),
        onError: () => {
          setSpeaking(undefined);
          setError(c("设备没有可用的目标语音，请检查系统语音设置。", "No matching device voice is available. Check system speech settings."));
        },
      });
    } catch {
      setSpeaking(undefined);
      setError(c("无法播放这段内容。", "This text could not be spoken."));
    }
  };

  return (
    <div className="pronunciation-controls">
      <button type="button" disabled={!supported} className={speaking === "normal" ? "active" : ""} aria-pressed={speaking === "normal"} onClick={() => void play("normal")}>
        {speaking === "normal" ? <Square size={13} /> : <Volume2 size={14} />}{speaking === "normal" ? c("停止", "Stop") : c("朗读", "Listen")}
      </button>
      <button type="button" disabled={!supported} className={speaking === "slow" ? "active" : ""} aria-pressed={speaking === "slow"} onClick={() => void play("slow")}>
        {speaking === "slow" ? <Square size={13} /> : <Gauge size={14} />}{speaking === "slow" ? c("停止", "Stop") : c("慢速", "Slow")}
      </button>
      {!supported && <small>{c("此浏览器不支持系统朗读", "System speech is unavailable in this browser")}</small>}
      {error && <small role="status">{error}</small>}
    </div>
  );
}
