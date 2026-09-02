"use client";

import { useEffect, useMemo, useState } from "react";
import { Gauge, Volume2 } from "lucide-react";
import {
  createPronunciationRequest,
  matchingPronunciationVoices,
  pronunciationPreference,
  type PronunciationPreference,
  type PronunciationPreferences,
  type PronunciationVoice,
} from "@learn-language/application/pronunciation";
import { createWebPronunciationPlayer, subscribeToWebPronunciationVoices } from "@/lib/pronunciation";
import { uiText, type AppLocale } from "@/lib/i18n";

export interface PronunciationTarget {
  languageId: string;
  label: string;
  sampleText: string;
}

export function PronunciationSettings({
  targets,
  preferences,
  locale,
  onChange,
}: {
  targets: readonly PronunciationTarget[];
  preferences: PronunciationPreferences;
  locale: AppLocale;
  onChange: (languageId: string, preference: PronunciationPreference) => void;
}) {
  const player = useMemo(() => createWebPronunciationPlayer(), []);
  const [voices, setVoices] = useState<readonly PronunciationVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState("");
  const [notice, setNotice] = useState("");
  const c = (zh: string, en: string) => uiText(locale, zh, en);

  useEffect(() => {
    let active = true;
    const refresh = () => void player.voices().then((next) => {
      if (active) {
        setVoices(next);
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    refresh();
    const unsubscribe = subscribeToWebPronunciationVoices(refresh);
    return () => {
      active = false;
      unsubscribe();
      void player.stop();
    };
  }, [player]);

  const preview = async (target: PronunciationTarget) => {
    const preference = pronunciationPreference(preferences, target.languageId);
    setNotice("");
    if (previewing === target.languageId) {
      await player.stop();
      setPreviewing("");
      return;
    }
    await player.speak(createPronunciationRequest(target.sampleText, target.languageId, preference.speed, preference.voiceId), {
      onStart: () => setPreviewing(target.languageId),
      onDone: () => setPreviewing(""),
      onError: () => {
        setPreviewing("");
        setNotice(c("试听失败。请检查浏览器或系统语音设置。", "Preview failed. Check browser or system speech settings."));
      },
    });
  };

  return (
    <section className="pronunciation-settings-panel" aria-labelledby="pronunciation-settings-title">
      <header><div><Volume2 size={19} /><p><strong id="pronunciation-settings-title">{c("发音与系统语音", "Pronunciation and system voices")}</strong><small>{c("按语种选择设备声音和默认语速；设置只保存在当前设备。", "Choose a device voice and default speed per language; settings stay on this device.")}</small></p></div><span>{voices.length} {c("个设备声音", "device voices")}</span></header>
      {!player.isSupported() ? <p className="voice-diagnostic">{c("此浏览器不支持系统朗读。可换用最新版 Chrome、Edge 或 Safari。", "System speech is unavailable. Try a current Chrome, Edge, or Safari browser.")}</p> : null}
      {targets.map((target) => {
        const preference = pronunciationPreference(preferences, target.languageId);
        const matching = matchingPronunciationVoices(voices, target.languageId);
        const otherVoices = voices.filter((voice) => !matching.some((candidate) => candidate.id === voice.id));
        const stale = Boolean(preference.voiceId && !voices.some((voice) => voice.id === preference.voiceId));
        return (
          <article key={target.languageId}>
            <div><strong>{target.label}</strong><small>{target.languageId}</small></div>
            <label><span>{c("设备声音", "Device voice")}</span><select disabled={loading || !player.isSupported()} value={stale ? "" : preference.voiceId ?? ""} onChange={(event) => { const voiceId = event.target.value; onChange(target.languageId, { speed: preference.speed, ...(voiceId ? { voiceId } : {}) }); }}><option value="">{c("系统自动选择", "System default")}</option>{matching.length > 0 ? <optgroup label={c("匹配当前语种", "Matching language")}>{matching.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.languageTag}{voice.localService ? c(" · 本机", " · local") : ""}</option>)}</optgroup> : null}{otherVoices.length > 0 ? <optgroup label={c("其他设备声音", "Other device voices")}>{otherVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.languageTag}{voice.localService ? c(" · 本机", " · local") : ""}</option>)}</optgroup> : null}</select></label>
            <label><span>{c("默认语速", "Default speed")}</span><select value={preference.speed} onChange={(event) => onChange(target.languageId, { ...preference, speed: event.target.value === "slow" ? "slow" : "normal" })}><option value="normal">{c("正常", "Normal")}</option><option value="slow">{c("慢速", "Slow")}</option></select></label>
            <button type="button" disabled={!player.isSupported()} onClick={() => void preview(target)}>{previewing === target.languageId ? c("停止试听", "Stop preview") : c("试听", "Preview")}<Gauge size={14} /></button>
            {!loading && matching.length === 0 ? <p className="voice-diagnostic">{c("未检测到标签匹配的声音；可使用系统自动选择，或手动试听其他设备声音。若播放失败，请安装该语言的语音包。", "No voice tag matches this language. Use system default or preview another device voice; install the language speech pack if playback fails.")}</p> : null}
            {stale ? <p className="voice-diagnostic">{c("原声音已不可用，已回退为系统自动选择。", "The saved voice is unavailable; system default is used.")}</p> : null}
          </article>
        );
      })}
      {notice ? <p className="voice-diagnostic" role="status">{notice}</p> : null}
    </section>
  );
}
