import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines, ChevronDown, CircleUserRound, Clock3, Download, FileAudio,
  Gauge, Headphones, Home, Mic2, MoreHorizontal, Play,
  Settings2, SlidersHorizontal, Sparkles, Video, WandSparkles,
  Zap, Check, Pause, RotateCcw, X
} from 'lucide-react';
import './media-preview.css';
import AudioTrimmer from './AudioTrimmer';

type FileSlotProps = {
  title: string;
  subtitle: string;
  accept: string;
  icon: React.ReactNode;
  file: File | null;
  onFile: (file: File | null) => void;
  onEdit: () => void;
};

function FileSlot({title, subtitle, accept, icon, file, onFile, onEdit}: FileSlotProps) {
  const input = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = () => input.current?.click();
  const removeFile = () => {
    if (input.current) input.current.value = '';
    onFile(null);
  };
  const isAudio = !!file && file.type.startsWith('audio/');
  const isVideo = !!file && file.type.startsWith('video/');

  return (
    <div className={`file-slot media-slot ${file ? 'file-slot--active media-slot--active' : ''}`}>
      <input ref={input} type="file" hidden accept={accept} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />

      {!file ? (
        <button type="button" className="media-slot__picker" onClick={chooseFile}>
          <span className="file-slot__icon">{icon}</span>
          <span className="file-slot__copy">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
          <span className="file-slot__action">Enviar</span>
        </button>
      ) : (
        <>
          <div className="media-slot__header">
            <span className="file-slot__icon media-slot__ok"><Check size={18}/></span>
            <span className="file-slot__copy">
              <strong title={file.name}>{file.name}</strong>
              <small>{`${(file.size / 1024 / 1024).toFixed(1)} MB · pronto`}</small>
            </span>
            <div className="media-slot__actions">
              <button type="button" className="media-slot__change" onClick={onEdit}>Cortar</button>
              <button type="button" className="media-slot__change" onClick={chooseFile}>Trocar</button>
              <button type="button" className="media-slot__remove" onClick={removeFile} title="Remover arquivo" aria-label="Remover arquivo"><X size={15}/></button>
            </div>
          </div>

          {isAudio && previewUrl && (
            <div className="media-slot__preview media-slot__preview--audio">
              <audio controls preload="metadata" src={previewUrl} />
            </div>
          )}

          {isVideo && previewUrl && (
            <div className="media-slot__preview media-slot__preview--video">
              <video controls preload="metadata" src={previewUrl} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WaveBars() {
  const bars = useMemo(() => Array.from({length: 72}, (_, i) => 13 + Math.abs(Math.sin(i * .61) * 28) + Math.abs(Math.cos(i * .23) * 14)), []);
  return <div className="wave">{bars.map((h, i) => <span key={i} style={{height: `${h}%`}} />)}</div>;
}

export default function App() {
  const [voiceAudio, setVoiceAudio] = useState<File|null>(null);
  const [voiceVideo, setVoiceVideo] = useState<File|null>(null);
  const [perfAudio, setPerfAudio] = useState<File|null>(null);
  const [perfVideo, setPerfVideo] = useState<File|null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [perfTranscript, setPerfTranscript] = useState('');
  const [script, setScript] = useState('Sua voz não precisa parecer gerada por inteligência artificial. Ela precisa soar como você — com ritmo, pausa e intenção.');
  const [speed, setSpeed] = useState(1);
  const [strength, setStrength] = useState(.85);
  const [mirrorPauses, setMirrorPauses] = useState(true);
  const [performanceOpen, setPerformanceOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [status, setStatus] = useState<'idle'|'generating'|'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('autoride_api_url') || '');
  const [engineConnected, setEngineConnected] = useState(false);
  const [mp3Url, setMp3Url] = useState('');
  const [wavUrl, setWavUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [editing, setEditing] = useState<'voiceAudio'|'voiceVideo'|'perfAudio'|'perfVideo'|'result'|null>(null);
  const [editedResultUrl, setEditedResultUrl] = useState('');
  const audioPlayer = useRef<HTMLAudioElement>(null);
  const resultAudio = editedResultUrl || mp3Url;

  useEffect(() => () => { if (editedResultUrl) URL.revokeObjectURL(editedResultUrl); }, [editedResultUrl]);

  const normalizedApiUrl = apiUrl.trim().replace(/\/$/, '');

  const checkEngine = async (url = normalizedApiUrl) => {
    if (!url) { setEngineConnected(false); return false; }
    try {
      const response = await fetch(`${url.replace(/\/$/, '')}/health`);
      const data = await response.json();
      const ok = response.ok && data?.status === 'ok';
      setEngineConnected(ok);
      return ok;
    } catch {
      setEngineConnected(false);
      return false;
    }
  };

  useEffect(() => {
    if (normalizedApiUrl) checkEngine(normalizedApiUrl);
  }, []);

  const configureApi = async () => {
    const typed = window.prompt('Cole aqui o link do motor OmniVoice que aparece no Colab (termina em trycloudflare.com):', normalizedApiUrl);
    if (typed === null) return;
    const clean = typed.trim().replace(/\/$/, '');
    setApiUrl(clean);
    localStorage.setItem('autoride_api_url', clean);
    if (!clean) { setEngineConnected(false); return; }
    const ok = await checkEngine(clean);
    alert(ok ? 'OmniVoice conectado com sucesso.' : 'Não consegui conectar. Confira se o Colab ainda está rodando e se o link foi copiado inteiro.');
  };

  const downloadAudio = (url: string, filename: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const togglePlayback = async () => {
    if (!audioPlayer.current || !resultAudio) return;
    if (audioPlayer.current.paused) { await audioPlayer.current.play(); setPlaying(true); }
    else { audioPlayer.current.pause(); setPlaying(false); }
  };

  const generate = async () => {
    if (!voiceAudio && !voiceVideo) { alert('Envie uma amostra de voz primeiro.'); return; }
    if (!script.trim()) { alert('Escreva o roteiro.'); return; }
    if (!normalizedApiUrl) {
      alert('Primeiro conecte o motor OmniVoice. Clique no botão de configurações no topo e cole o link gerado pelo Colab.');
      return;
    }

    setStatus('generating');
    setProgress(8);
    setErrorMessage('');
    setMp3Url('');
    setWavUrl('');
    setEditedResultUrl('');
    setPlaying(false);

    const timer = window.setInterval(() => {
      setProgress(p => Math.min(88, p + Math.max(1, Math.round((88 - p) * 0.08))));
    }, 650);

    try {
      const form = new FormData();
      if (voiceAudio) form.append('voice_audio', voiceAudio);
      if (voiceVideo) form.append('voice_video', voiceVideo);
      form.append('voice_transcript', voiceTranscript);
      form.append('script', script.trim());
      form.append('speed', String(speed));
      if (perfAudio) form.append('performance_audio', perfAudio);
      if (perfVideo) form.append('performance_video', perfVideo);
      form.append('performance_transcript', perfTranscript);
      form.append('performance_strength', String(strength));
      form.append('mirror_pauses', String(mirrorPauses));

      const response = await fetch(`${normalizedApiUrl}/generate`, { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.status !== 'ok') throw new Error(data?.detail || data?.message || `Erro ${response.status}`);

      setMp3Url(data.mp3_data_url || data.audio_url || '');
      setWavUrl(data.wav_data_url || '');
      setProgress(100);
      setStatus('done');
      setEngineConnected(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao gerar voz.';
      setErrorMessage(message);
      setStatus('idle');
      setProgress(0);
      setEngineConnected(false);
    } finally {
      window.clearInterval(timer);
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand"><div className="brand__mark">A</div><div><strong>Autoride <i>AI</i></strong><span>Voice Studio</span></div></div>
        <nav className="nav">
          <span className="nav__section">Workspace</span>
          <button><Home size={17}/> Home</button>
          <button className="active"><AudioLines size={17}/> Voice Studio <span className="nav__dot"/></button>
          <button><Mic2 size={17}/> Minhas vozes</button>
          <button><Clock3 size={17}/> Histórico</button>
          <span className="nav__section nav__section--lower">Ferramentas</span>
          <button><SlidersHorizontal size={17}/> Presets</button>
          <button onClick={configureApi}><Settings2 size={17}/> Configurações</button>
        </nav>
        <div className="sidebar__bottom">
          <div className="engine"><span className="engine__dot"/><div><strong>OmniVoice</strong><small>{engineConnected ? 'GPU engine online' : 'Aguardando Colab'}</small></div></div>
          <button className="profile"><CircleUserRound size={20}/><div><strong>Meu Studio</strong><small>Pro workspace</small></div><MoreHorizontal size={17}/></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">VOICE GENERATION</span><h1>Voice Studio</h1></div>
          <div className="topbar__actions">
            <div className={`engine-pill ${engineConnected ? 'online' : 'offline'}`}><span/> OmniVoice · {engineConnected ? 'Online' : 'Conectar'}</div>
            <button className="icon-btn" onClick={configureApi} title="Conectar ao OmniVoice"><Settings2 size={17}/></button>
          </div>
        </header>

        <section className="workspace">
          <div className="composer">
            <section className="card identity-card">
              <div className="card__heading"><div className="step">01</div><div><h2>Identidade da voz</h2><p>A amostra define quem está falando.</p></div><div className="badge">VOICE ID</div></div>
              <div className="upload-grid">
                <FileSlot title="Áudio de referência" subtitle="WAV, MP3 · escolha uma voz de 3 a 10s" accept="audio/*" icon={<FileAudio size={18}/>} file={voiceAudio} onFile={file => { setVoiceAudio(file); if(file) {setVoiceVideo(null);setVoiceTranscript('');setEditing('voiceAudio');} }} onEdit={()=>setEditing('voiceAudio')}/>
                <FileSlot title="Ou envie um vídeo" subtitle="Escolha uma voz de 3 a 10s" accept="video/*" icon={<Video size={18}/>} file={voiceVideo} onFile={file => { setVoiceVideo(file); if(file) {setVoiceAudio(null);setVoiceTranscript('');setEditing('voiceVideo');} }} onEdit={()=>setEditing('voiceVideo')}/>
              </div>
              <details className="clean-details"><summary>Transcrição da amostra <span>recomendado</span></summary><textarea value={voiceTranscript} onChange={e => setVoiceTranscript(e.target.value)} placeholder="Escreva exatamente o que foi falado na amostra..."/></details>
            </section>

            <section className="card script-card">
              <div className="card__heading"><div className="step">02</div><div><h2>Roteiro</h2><p>Escreva exatamente o que a voz deve falar.</p></div><div className="chars">{script.length} caracteres</div></div>
              <div className="script-shell"><textarea value={script} onChange={e => setScript(e.target.value)} placeholder="Cole ou escreva o roteiro..."/><div className="script-toolbar"><span><Sparkles size={14}/> Português · Brasil</span><span>Modelo: OmniVoice</span></div></div>
            </section>

            <section className={`card performance-card ${performanceOpen ? 'is-open' : ''}`}>
              <button className="section-toggle" onClick={() => setPerformanceOpen(!performanceOpen)}><div className="card__heading card__heading--toggle"><div className="step">03</div><div><h2>Performance <span className="beta">BETA</span></h2><p>Use outra gravação para orientar ritmo, pausas e dinâmica.</p></div></div><ChevronDown size={18}/></button>
              {performanceOpen && <div className="performance-body">
                <div className="notice"><WandSparkles size={17}/><span>A identidade vocal continua vindo da etapa 01. Aqui usamos somente a <b>interpretação</b> da referência.</span></div>
                <div className="upload-grid">
                  <FileSlot title="Áudio de performance" subtitle="Cadência, energia e pausas" accept="audio/*" icon={<Headphones size={18}/>} file={perfAudio} onFile={file => {setPerfAudio(file); if(file) {setPerfVideo(null);setEditing('perfAudio');}}} onEdit={()=>setEditing('perfAudio')}/>
                  <FileSlot title="Ou envie um vídeo" subtitle="A fala será analisada" accept="video/*" icon={<Video size={18}/>} file={perfVideo} onFile={file => {setPerfVideo(file); if(file) {setPerfAudio(null);setEditing('perfVideo');}}} onEdit={()=>setEditing('perfVideo')}/>
                </div>
                <textarea className="mini-textarea" value={perfTranscript} onChange={e => setPerfTranscript(e.target.value)} placeholder="Transcrição da performance · opcional"/>
                <div className="control-row">
                  <div className="control"><div className="control__top"><span>Força do espelhamento</span><b>{Math.round(strength*100)}%</b></div><input type="range" min="0" max="1" step=".05" value={strength} onChange={e => setStrength(Number(e.target.value))}/></div>
                  <label className="switch-line"><span><strong>Estrutura de pausas</strong><small>Espelhar pausas da referência</small></span><input type="checkbox" checked={mirrorPauses} onChange={e=>setMirrorPauses(e.target.checked)}/><i/></label>
                </div>
              </div>}
            </section>

            <section className="card advanced-card">
              <button className="section-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}><div className="inline-title"><Gauge size={17}/><span>Ajustes avançados</span></div><ChevronDown size={18}/></button>
              {advancedOpen && <div className="advanced-body"><div className="control"><div className="control__top"><span>Velocidade base</span><b>{speed.toFixed(2)}×</b></div><input type="range" min=".7" max="1.3" step=".05" value={speed} onChange={e => setSpeed(Number(e.target.value))}/></div></div>}
            </section>

            <button className={`generate ${status==='generating' ? 'generating' : ''}`} onClick={generate} disabled={status==='generating'}>{status==='generating' ? <><span className="spinner"/> GERANDO · {progress}%</> : <><Zap size={18}/> GERAR VOZ</>}</button>
          </div>

          <aside className="result-panel">
            <div className="result-panel__top"><div><span className="eyebrow">STUDIO OUTPUT</span><h2>Resultado</h2></div><div className={`status-pill ${status}`}><span/>{status==='idle' ? 'Aguardando' : status==='generating' ? 'Gerando' : 'Concluído'}</div></div>
            <div className={`player-card ${status==='done' ? 'player-card--ready' : ''}`}><div className="player-art"><AudioLines size={30}/>{status==='done' && <span className="ready-check"><Check size={12}/></span>}</div><div className="player-copy"><strong>{status==='done' ? 'autoride_voice_001' : 'Sua geração aparecerá aqui'}</strong><small>{status==='done' ? 'OmniVoice · Português · geração real' : 'Envie a voz e escreva o roteiro'}</small></div></div>
            <div className="wave-wrap"><WaveBars/>{status==='generating' && <div className="progress-line" style={{width:`${progress}%`}}/>}</div>
            <div className="transport"><button className="round" disabled={status!=='done'} onClick={()=>{if(audioPlayer.current){audioPlayer.current.currentTime=0; audioPlayer.current.play();setPlaying(true);}}} aria-label="Reiniciar áudio"><RotateCcw size={15}/></button><button className="play" disabled={status!=='done'} onClick={togglePlayback}>{playing ? <Pause size={20}/> : <Play size={20} fill="currentColor"/>}</button><button className="round" disabled={status!=='done'} onClick={()=>setEditing('result')} aria-label="Cortar áudio gerado"><SlidersHorizontal size={16}/></button></div>
            <audio ref={audioPlayer} src={resultAudio || undefined} onEnded={()=>setPlaying(false)} onLoadedMetadata={(e)=>setDuration(e.currentTarget.duration || 0)} />
            {status==='done' && <div className="result-edit-actions"><button type="button" onClick={()=>setEditing('result')}>Cortar áudio</button><button type="button" onClick={generate}>Refazer geração</button></div>}
            <div className="time-row"><span>00:00</span><span>{status==='done' ? `${Math.floor(duration/60).toString().padStart(2,'0')}:${Math.floor(duration%60).toString().padStart(2,'0')}` : '--:--'}</span></div>
            <div className="generation-meta"><div><span>Voz</span><strong>{voiceAudio?.name || voiceVideo?.name || 'Não selecionada'}</strong></div><div><span>Velocidade</span><strong>{speed.toFixed(2)}×</strong></div><div><span>Performance</span><strong>{perfAudio || perfVideo ? `${Math.round(strength*100)}%` : 'Desativada'}</strong></div></div>
            <div className="download-grid">
              <button disabled={status!=='done' || !mp3Url} onClick={()=>downloadAudio(mp3Url,'autoride_voz_original.mp3')}><Download size={16}/><span><strong>MP3 original</strong><small>Geração completa</small></span></button>
              <button disabled={status!=='done' || !(editedResultUrl || wavUrl)} onClick={()=>downloadAudio(editedResultUrl || wavUrl,editedResultUrl ? 'autoride_voz_recortada.wav' : 'autoride_voz.wav')}><Download size={16}/><span><strong>{editedResultUrl ? 'WAV recortado' : 'WAV'}</strong><small>{editedResultUrl ? 'Trecho selecionado' : 'Sem compressão'}</small></span></button>
            </div>
            <div className="pro-tip"><Sparkles size={16}/><p><b>Studio tip</b><br/>Amostra de voz limpa e curta tende a preservar melhor identidade e naturalidade.</p></div>
            {errorMessage && <div className="api-error" role="alert">{errorMessage} <button type="button" onClick={generate}>Tentar novamente</button></div>}
            <div className="engine-card"><div><span className="live-dot"/><b>Engine</b></div><span>{engineConnected ? 'OmniVoice / CUDA conectado' : 'Clique em ⚙ para conectar'}</span></div>
          </aside>
        </section>
      </main>
      {editing && (editing==='result' ? resultAudio : ({voiceAudio,voiceVideo,perfAudio,perfVideo})[editing]) && <AudioTrimmer
        source={editing==='result' ? resultAudio : ({voiceAudio,voiceVideo,perfAudio,perfVideo})[editing]!}
        title={editing==='result' ? 'Cortar áudio gerado' : 'Cortar amostra antes de gerar'}
        onCancel={()=>setEditing(null)}
        onApply={file=>{
          if(editing==='result') { audioPlayer.current?.pause();setPlaying(false);setEditedResultUrl(URL.createObjectURL(file)); }
          else if(editing==='voiceVideo') {setVoiceVideo(null);setVoiceAudio(file);setVoiceTranscript('');}
          else if(editing==='perfVideo') {setPerfVideo(null);setPerfAudio(file);}
          else if(editing==='voiceAudio') {setVoiceAudio(file);setVoiceTranscript('');}
          else setPerfAudio(file);
          setEditing(null);
        }}/>
      }
    </div>
  );
}
