# Autoride AI — Voice Studio / Google AI Studio

Projeto de interface premium para o motor OmniVoice já usado no Autoride Voice Studio v5.

## O que foi preservado do notebook atual

- Amostra de identidade por áudio ou vídeo.
- Campo de transcrição da amostra.
- Roteiro em português.
- Performance opcional por áudio ou vídeo.
- Transcrição opcional da performance.
- Força do espelhamento.
- Espelhamento da estrutura de pausas.
- Velocidade base de 0.70x a 1.30x.
- Saída planejada em MP3 e WAV.
- OmniVoice continua sendo o motor de voz.

## Importante

Este pacote é a **camada de produto/interface**. Ele não tenta carregar CUDA/PyTorch/OmniVoice dentro do Google AI Studio.

O OmniVoice continua no ambiente com GPU (por exemplo, seu Colab atual). Depois, a interface pode ser conectada ao motor por uma API HTTP.

A prévia atual usa um fluxo visual simulado ao clicar em "GERAR VOZ", para que você consiga avaliar a roupagem imediatamente no Google AI Studio.

## Abrir no Google AI Studio

1. Entre no Google AI Studio e abra **Build**.
2. Crie um projeto web vazio.
3. Abra a aba **Code**.
4. Use **Add files (+)** e envie este projeto/ZIP quando essa opção estiver disponível.
5. Se preferir o fluxo oficial mais estável, envie esta pasta para um repositório GitHub e use **Import from GitHub**.
6. Peça ao agente:  
   `Preserve exatamente o design e o fluxo deste projeto. Apenas faça o projeto rodar no preview. Não simplifique a interface.`

## Próxima ligação com o motor

Contrato recomendado para o motor externo:

POST /generate (multipart/form-data)

Campos:
- voice_audio
- voice_video
- voice_transcript
- script
- speed
- performance_audio
- performance_video
- performance_transcript
- performance_strength
- mirror_pauses

Resposta:
```json
{
  "status": "ok",
  "audio_url": "https://.../preview.wav",
  "mp3_url": "https://.../output.mp3",
  "wav_url": "https://.../output.wav",
  "directed_script": "...",
  "message": "..."
}
```

Assim a aparência não depende de onde a GPU estiver hospedada.
