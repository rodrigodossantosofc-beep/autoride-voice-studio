import React, {useEffect, useRef, useState} from 'react';
import {trimAudio} from './audio-edit';
import './audio-trimmer.css';

type Props = {
  source: File | string;
  title: string;
  onCancel: () => void;
  onApply: (file: File) => void;
};

export default function AudioTrimmer({source, title, onCancel, onApply}: Props) {
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const player = useRef<HTMLMediaElement>(null);
  const isVideo = source instanceof File && source.type.startsWith('video/');

  useEffect(() => {
    const next = source instanceof File ? URL.createObjectURL(source) : source;
    setUrl(next);
    return () => { if (source instanceof File) URL.revokeObjectURL(next); };
  }, [source]);

  const preview = async () => {
    const media = player.current;
    if (!media) return;
    if (!media.paused) { media.pause(); return; }
    media.currentTime = start;
    try { await media.play(); } catch { setError('Não foi possível reproduzir este arquivo.'); }
  };

  const apply = async () => {
    setBusy(true); setError('');
    player.current?.pause();
    try { onApply(await trimAudio(source, start, end)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível cortar o áudio.'); }
    finally { setBusy(false); }
  };

  return <div className="trimmer-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
    <div className="trimmer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="trimmer__top"><div><small>EDIÇÃO DE ÁUDIO</small><h2>{title}</h2></div><button type="button" onClick={onCancel} disabled={busy} aria-label="Fechar">×</button></div>
      {isVideo ? <video ref={player as React.RefObject<HTMLVideoElement>} src={url} controls preload="metadata" onLoadedMetadata={e => { const length = e.currentTarget.duration; setDuration(length); setEnd(length); }} onTimeUpdate={e => { if (e.currentTarget.currentTime >= end) e.currentTarget.pause(); }}/>
        : <audio ref={player as React.RefObject<HTMLAudioElement>} src={url} controls preload="metadata" onLoadedMetadata={e => { const length = e.currentTarget.duration; setDuration(length); setEnd(length); }} onTimeUpdate={e => { if (e.currentTarget.currentTime >= end) e.currentTarget.pause(); }}/>} 
      <p>Arraste o começo e o fim para escolher o trecho. O arquivo original continua disponível.</p>
      <label>Começo <strong>{start.toFixed(1)}s</strong><input type="range" min="0" max={Math.max(0, end - .2)} step="0.1" value={start} onChange={e => setStart(Number(e.target.value))}/></label>
      <label>Fim <strong>{end.toFixed(1)}s</strong><input type="range" min={Math.min(duration, start + .2)} max={duration} step="0.1" value={end} onChange={e => setEnd(Number(e.target.value))}/></label>
      <div className="trimmer__selection">Trecho selecionado: <b>{Math.max(0, end - start).toFixed(1)}s</b></div>
      {error && <div className="trimmer__error" role="alert">{error}</div>}
      <div className="trimmer__actions"><button type="button" onClick={preview} disabled={!duration || busy}>Ouvir trecho</button><button type="button" onClick={onCancel} disabled={busy}>Cancelar</button><button type="button" className="trimmer__apply" onClick={apply} disabled={!duration || busy || end-start<.2}>{busy ? 'Cortando...' : 'Aplicar corte'}</button></div>
    </div>
  </div>;
}
