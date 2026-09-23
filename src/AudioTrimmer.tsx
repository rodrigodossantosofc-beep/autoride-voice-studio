import React, {useEffect, useMemo, useRef, useState} from 'react';
import {decodeSource, exportSegments, type Segment} from './audio-edit';
import './audio-trimmer.css';

type Props = {
  source: File | string;
  title: string;
  onCancel: () => void;
  onApply: (file: File) => void;
};

type Selection = {start: number; end: number};
const MIN = .2;
const format = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;

function waveform(buffer: AudioBuffer, count: number): number[] {
  const samples = buffer.getChannelData(0);
  return Array.from({length: count}, (_, index) => {
    const from = Math.floor(index * samples.length / count);
    const to = Math.floor((index + 1) * samples.length / count);
    const stride = Math.max(1, Math.floor((to - from) / 32));
    let peak = 0;
    for (let i = from; i < to; i += stride) peak = Math.max(peak, Math.abs(samples[i]));
    return Math.max(.05, Math.sqrt(peak));
  });
}

export default function AudioTrimmer({source, title, onCancel, onApply}: Props) {
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [cursor, setCursor] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [history, setHistory] = useState<Segment[][]>([]);
  const audio = useRef<HTMLAudioElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const anchor = useRef<number | null>(null);
  const isVideo = source instanceof File && source.type.startsWith('video/');

  useEffect(() => {
    let active = true;
    setLoading(true);
    decodeSource(source).then(decoded => {
      if (!active) return;
      setBuffer(decoded);
      setSegments([{start: 0, end: decoded.duration}]);
      setLoading(false);
    }).catch(err => {
      if (active) { setError(err instanceof Error ? err.message : 'Não foi possível abrir a amostra.'); setLoading(false); }
    });
    return () => { active = false; };
  }, [source]);

  useEffect(() => {
    if (!buffer || !segments.length) return;
    const url = URL.createObjectURL(exportSegments(buffer, segments));
    setPreviewUrl(url);
    setPlaying(false);
    return () => URL.revokeObjectURL(url);
  }, [buffer, segments]);

  const duration = buffer?.duration || 0;
  const peaks = useMemo(() => buffer ? waveform(buffer, 220) : [], [buffer]);
  const kept = segments.reduce((sum, part) => sum + part.end - part.start, 0);
  const usableSelection = selection && selection.end - selection.start >= MIN;
  const point = (clientX: number) => {
    const box = timeline.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, (clientX - box.left) / box.width * duration));
  };
  const commit = (next: Segment[]) => {
    if (!next.length || next.reduce((sum, part) => sum + part.end - part.start, 0) < MIN) {
      setError('Deixe pelo menos 0,2 segundo de voz.'); return;
    }
    audio.current?.pause();
    setHistory(old => [...old, segments]);
    setSegments(next);
    setSelection(null);
    setError('');
  };
  const removeSelection = () => {
    if (!usableSelection) return;
    commit(segments.flatMap(part => {
      if (selection.end <= part.start || selection.start >= part.end) return [part];
      return [
        {start: part.start, end: Math.min(part.end, selection.start)},
        {start: Math.max(part.start, selection.end), end: part.end}
      ].filter(piece => piece.end - piece.start >= MIN);
    }));
  };
  const keepSelection = () => {
    if (!usableSelection) return;
    commit(segments.map(part => ({start: Math.max(part.start, selection.start), end: Math.min(part.end, selection.end)})).filter(part => part.end - part.start >= MIN));
  };
  const split = () => {
    if (!segments.some(part => cursor > part.start + MIN && cursor < part.end - MIN)) return;
    commit(segments.flatMap(part => cursor > part.start + MIN && cursor < part.end - MIN ? [{start: part.start, end: cursor}, {start: cursor, end: part.end}] : [part]));
  };
  const apply = () => {
    if (!buffer) return;
    setBusy(true);
    try { onApply(exportSegments(buffer, segments)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o áudio.'); }
    finally { setBusy(false); }
  };
  const originalPosition = (editedPosition: number) => {
    let remaining = editedPosition;
    for (const part of segments) {
      if (remaining <= part.end - part.start) return part.start + remaining;
      remaining -= part.end - part.start;
    }
    return segments.at(-1)?.end || 0;
  };

  return <div className="trimmer-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <div className="trimmer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="trimmer__top"><div><small>EDITOR DE VOZ</small><h2>{title}</h2></div><button type="button" onClick={onCancel} disabled={busy} aria-label="Fechar">×</button></div>
      {isVideo && <p className="trimmer__notice">Vamos usar somente a voz do vídeo. A edição salva o áudio como WAV.</p>}
      {loading ? <p role="status">Preparando a forma de onda{isVideo ? ' e extraindo o áudio do vídeo' : ''}…</p> : buffer && <>
        <p>Arraste sobre a onda para selecionar uma parte. Remova o meio ou mantenha só a voz que você quer.</p>
        <div className="trimmer__ruler"><span>00:00</span><span>{format(duration / 2)}</span><span>{format(duration)}</span></div>
        <div ref={timeline} className="trimmer__timeline" role="slider" tabIndex={0} aria-label="Posição na forma de onda" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={cursor} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setCursor(value => Math.max(0, Math.min(duration, value + (event.key === 'ArrowRight' ? .1 : -.1)))); } }} onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const value = point(event.clientX);
          anchor.current = value;
          setCursor(value);
          setSelection(null);
        }} onPointerMove={event => {
          if (anchor.current === null) return;
          const value = point(event.clientX);
          setSelection({start: Math.min(anchor.current, value), end: Math.max(anchor.current, value)});
        }} onPointerUp={event => {
          if (anchor.current === null) return;
          const value = point(event.clientX);
          const start = Math.min(anchor.current, value);
          const end = Math.max(anchor.current, value);
          setSelection(end - start >= MIN ? {start, end} : null);
          anchor.current = null;
        }} onPointerCancel={() => { anchor.current = null; }}>
          <svg viewBox={`0 0 ${peaks.length * 3} 100`} preserveAspectRatio="none" aria-hidden="true">
            {peaks.map((height, index) => {
              const time = (index + .5) / peaks.length * duration;
              const retained = segments.some(part => time >= part.start && time <= part.end);
              return <rect key={index} x={index * 3} y={50 - height * 44} width="2" height={height * 88} fill={retained ? '#a993ff' : '#59606b'} />;
            })}
          </svg>
          {segments.map((part, index) => <div key={index} className="trimmer__segment" style={{left: `${part.start / duration * 100}%`, width: `${(part.end - part.start) / duration * 100}%`}}><span>{index + 1}</span></div>)}
          {selection && <div className="trimmer__range" style={{left: `${selection.start / duration * 100}%`, width: `${(selection.end - selection.start) / duration * 100}%`}} />}
          <div className="trimmer__playhead" style={{left: `${cursor / duration * 100}%`}} />
        </div>
        <div className="trimmer__selection">{usableSelection ? <>Seleção: <b>{format(selection.start)} – {format(selection.end)}</b></> : <>Arraste na onda para selecionar. Clique para posicionar a divisão.</>}<span>Áudio final: <b>{format(kept)}</b></span></div>
        <div className="trimmer__toolbar">
          <button type="button" onClick={split} disabled={!segments.some(part => cursor > part.start + MIN && cursor < part.end - MIN)}>Dividir no cursor</button>
          <button type="button" onClick={removeSelection} disabled={!usableSelection}>Remover seleção</button>
          <button type="button" onClick={keepSelection} disabled={!usableSelection}>Manter só seleção</button>
          <button type="button" onClick={() => { const previous = history.at(-1); if (previous) {setSegments(previous);setHistory(old => old.slice(0, -1));setSelection(null);} }} disabled={!history.length}>Desfazer</button>
        </div>
        <div className="trimmer__preview"><span>Ouça como vai ficar, com os cortes unidos:</span><audio ref={audio} controls src={previewUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={event => { if (playing) setCursor(originalPosition(event.currentTarget.currentTime)); }} /></div>
      </>}
      {error && <div className="trimmer__error" role="alert">{error}</div>}
      <div className="trimmer__actions"><button type="button" onClick={onCancel} disabled={busy}>Cancelar</button><button type="button" className="trimmer__apply" onClick={apply} disabled={!buffer || loading || busy}>{busy ? 'Salvando…' : 'Usar áudio editado'}</button></div>
    </div>
  </div>;
}
