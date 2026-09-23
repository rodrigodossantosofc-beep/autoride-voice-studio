export type Segment = {start: number; end: number};

function encodeWav(buffer: AudioBuffer, segments: Segment[]): Blob {
  const channels = buffer.numberOfChannels;
  const frames = segments.reduce((sum, part) => sum + Math.max(0, Math.min(buffer.length, Math.round(part.end * buffer.sampleRate)) - Math.round(part.start * buffer.sampleRate)), 0);
  const data = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(data);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, 'RIFF'); view.setUint32(4, data.byteLength - 8, true);
  write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, frames * channels * 2, true);
  const samples = Array.from({length: channels}, (_, ch) => buffer.getChannelData(ch));
  let offset = 44;
  for (const part of segments) {
    const from = Math.max(0, Math.round(part.start * buffer.sampleRate));
    const to = Math.min(buffer.length, Math.round(part.end * buffer.sampleRate));
    for (let i = from; i < to; i++) for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, samples[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([data], {type: 'audio/wav'});
}

async function recordVideoAudio(file: File, duration: number): Promise<ArrayBuffer> {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  video.src = url;
  video.preload = 'auto';
  video.playsInline = true;
  const context = new AudioContext();
  try {
    await context.resume();
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Não foi possível abrir o vídeo.'));
    });
    const source = context.createMediaElementSource(video);
    const destination = context.createMediaStreamDestination();
    source.connect(destination);
    const type = ['audio/webm;codecs=opus', 'audio/webm'].find(value => MediaRecorder.isTypeSupported(value));
    if (!type) throw new Error('Este navegador não permite extrair áudio do vídeo.');
    const recorder = new MediaRecorder(destination.stream, {mimeType: type});
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const completed = new Promise<ArrayBuffer>((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Falha ao ler a faixa de áudio do vídeo.'));
      recorder.onstop = async () => resolve(await new Blob(chunks, {type}).arrayBuffer());
    });
    recorder.start();
    await video.play();
    await new Promise<void>(resolve => {
      const stop = () => { video.removeEventListener('ended', stop); resolve(); };
      video.addEventListener('ended', stop);
      window.setTimeout(stop, (duration + 2) * 1000);
    });
    recorder.stop();
    video.pause();
    return await completed;
  } finally {
    video.pause();
    URL.revokeObjectURL(url);
    await context.close();
  }
}

export async function decodeSource(source: File | string): Promise<AudioBuffer> {
  const localUrl = source instanceof File ? URL.createObjectURL(source) : null;
  let bytes: ArrayBuffer;
  try {
    const response = await fetch(localUrl || (source as string));
    if (!response.ok) throw new Error('Não foi possível carregar o áudio para edição.');
    bytes = await response.arrayBuffer();
  } finally {
    if (localUrl) URL.revokeObjectURL(localUrl);
  }
  const context = new AudioContext();
  try {
    try { return await context.decodeAudioData(bytes.slice(0)); }
    catch (error) {
      if (!(source instanceof File) || !source.type.startsWith('video/')) throw error;
      const video = document.createElement('video');
      const url = URL.createObjectURL(source);
      const duration = await new Promise<number>((resolve, reject) => {
        video.onloadedmetadata = () => resolve(video.duration);
        video.onerror = () => reject(new Error('Não foi possível abrir o vídeo.'));
        video.src = url;
      }).finally(() => URL.revokeObjectURL(url));
      if (!Number.isFinite(duration)) throw new Error('Não foi possível identificar a duração do vídeo.');
      return await context.decodeAudioData(await recordVideoAudio(source, duration));
    }
  } finally { await context.close(); }
}

export function exportSegments(buffer: AudioBuffer, segments: Segment[]): File {
  if (segments.reduce((sum, part) => sum + part.end - part.start, 0) < .2) throw new Error('Deixe pelo menos 0,2 segundo de áudio.');
  return new File([encodeWav(buffer, segments)], 'audio-editado.wav', {type: 'audio/wav'});
}
