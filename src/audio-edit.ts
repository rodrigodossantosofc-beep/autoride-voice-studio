/** Keep edits local to the browser; the OmniVoice endpoint only receives the chosen excerpt. */
function encodeWav(buffer: AudioBuffer, start: number, end: number): Blob {
  const from = Math.floor(start * buffer.sampleRate);
  const to = Math.min(buffer.length, Math.ceil(end * buffer.sampleRate));
  const frames = to - from;
  const channels = buffer.numberOfChannels;
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
  for (let i = from; i < to; i++) for (let ch = 0; ch < channels; ch++) {
    const sample = Math.max(-1, Math.min(1, samples[ch][i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([data], {type: 'audio/wav'});
}

async function recordVideoAudio(file: File, start: number, end: number): Promise<Blob> {
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  video.src = url;
  video.preload = 'auto';
  // Route the sound only into the recorder, never to the speakers.
  video.muted = false;
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
    if (start > 0) {
      video.currentTime = start;
      await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm'].find(MediaRecorder.isTypeSupported);
    if (!type) throw new Error('Este navegador não permite extrair o áudio do vídeo.');
    const recorder = new MediaRecorder(destination.stream, {mimeType: type});
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const completed = new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error('Falha ao gravar o trecho selecionado.'));
      recorder.onstop = () => resolve(new Blob(chunks, {type}));
    });
    recorder.start();
    await video.play();
    await new Promise<void>(resolve => window.setTimeout(resolve, (end - start) * 1000));
    recorder.stop();
    video.pause();
    return await completed;
  } finally {
    video.pause();
    URL.revokeObjectURL(url);
    await context.close();
  }
}

export async function trimAudio(source: File | string, start: number, end: number): Promise<File> {
  if (end - start < 0.2) throw new Error('Selecione pelo menos 0,2 segundo de áudio.');
  if (source instanceof File && source.type.startsWith('video/')) {
    const blob = await recordVideoAudio(source, start, end);
    return new File([blob], 'amostra-recortada.webm', {type: blob.type});
  }
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
    const decoded = await context.decodeAudioData(bytes);
    return new File([encodeWav(decoded, start, end)], 'audio-recortado.wav', {type: 'audio/wav'});
  } finally {
    await context.close();
  }
}
