# Still Enhancer
Client-side, offline PWA for enhancing CCTV/doorbell stills and organizing a case board (timeline, sightings map, compare). Images never leave the device. No face recognition or identity lookup. Exports a ZIP with untouched originals, enhanced PNGs, SHA-256 hashes and adjustment logs.

## AI upscale (optional, on-device)
Mode select: Classical / AI 2x / AI 4x. Uses **realesr-general-x4v3** (Real-ESRGAN v0.2.5.0, BSD-3-Clause, see `models/LICENSE-Real-ESRGAN.txt`) converted to ONNX, run with onnxruntime-web 1.20.1 (MIT) in a Web Worker (WebGPU, WASM fallback). The model and runtime are fetched on first use and then cached for offline use. Input is limited to 1 MP, so crop first.
**AI upscale generates detail — for leads, not evidence; original preserved.** The model, its hashes, the execution provider, tile size and timing are written to each still's export log. No face restoration models are used.
