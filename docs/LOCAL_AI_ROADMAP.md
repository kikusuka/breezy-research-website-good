# Browser-local AI roadmap

## Decision

Breezy should explore browser-local AI through WebGPU, but add it incrementally as an optional capability. Do not introduce a second Research mode or change the existing single-model Research workflow. Local AI is a separate execution capability; Research continues to show its configured research model and its one-call analysis workflow.

The initial goal is to make selected tasks work locally without requiring a paid inference API. This is not a promise that every device can run every model, that inference is always faster, or that every task can run offline from first launch.

## Why this fits Breezy

- **Cost control:** after a model is downloaded, supported tasks can run on the user's device without per-token inference charges. Model hosting/download bandwidth and development still have costs.
- **Privacy:** local inference can keep task inputs on-device. The UI must say precisely which operations stay local; web search, account sync, bug reports, and other server features may still send data elsewhere.
- **Progressive enhancement:** Breezy remains usable when WebGPU is unavailable, memory is limited, or a model fails to load.
- **User control:** never download multi-hundred-megabyte or multi-gigabyte model files without an explicit action. Show model size, storage use, download progress, cancellation, and a clear remove-model control.
- **Honest behavior:** no silent switch to a cloud model. If local inference is unavailable or fails, explain why and let the user decide what to do next.

## Recommended implementation order

### Phase 0 — capability and runtime spike

1. Verify WebGPU in a secure context and request an adapter; the existence of navigator.gpu alone is not enough to guarantee initialization.
2. Probe worker support, adapter/device creation, browser storage availability, and a small known test operation.
3. Test target browsers and representative low-memory Android devices. Do not infer capacity from browser name alone.
4. Choose one runtime for each task only after a small proof of concept. Keep the runtime behind a narrow service boundary and lazy-load it so normal Breezy startup does not pay the bundle cost.
5. Report unsupported, blocked, initializing, downloading, ready, failed, and removed states truthfully.

### Phase 1 — local embeddings and document retrieval

Start here because it is useful for Breezy's document/research workflow and generally lighter than local text generation.

- Evaluate Transformers.js with a small, supported embedding model on WebGPU, with a CPU/WASM fallback only when practical.
- Embed user-selected local documents in a Web Worker and keep vectors and source chunks in IndexedDB.
- Search the local index for relevant passages; show the source filename and matching excerpt.
- Make local indexing opt-in and provide per-document deletion plus clear-index controls.
- Keep local documents out of backend requests unless the user explicitly chooses a server-backed action.
- Measure first-download size, peak memory, latency, retrieval quality, cancellation, and recovery from quota/storage errors.

### Phase 2 — optional local text generation

- Prototype one small, permissively licensed instruct model with WebLLM/MLC-LLM or another runtime after testing device coverage.
- Keep it in a separate Local AI/Chat capability; do not present it as an alternative Research workflow or silently replace the configured research provider.
- Use a Web Worker, cancellable generation, bounded context, and a clear model download/removal lifecycle.
- Clearly label output as locally generated and explain that the model may be less capable than configured cloud providers.
- If unavailable, offer an explicit choice to use the existing configured provider or stop. Never auto-fallback.

### Phase 3 — speech and other modalities

Only after text/embeddings are stable, evaluate speech-to-text, text-to-speech, and image tasks independently. Each has different model sizes, browser support, performance, and privacy implications. Do not bundle every modality into the first release.

## Non-goals for the first release

- No automatic 1B–9B model downloads.
- No claim that 30–100 tokens/second or 1–4 second image generation is typical.
- No assumption that Firefox, Safari, Android browsers, or embedded WebViews have equivalent WebGPU support.
- No cloud fallback without a clear user choice.
- No mixing local-model status into Research's one-call model indicator.
- No uploading private local documents merely to make local RAG work.

## Acceptance criteria

- Feature detection checks secure context and actually attempts adapter initialization.
- No model files download until the user explicitly starts a download.
- Unsupported browsers receive a clear explanation and the rest of Breezy still works.
- The user can cancel a download or generation and remove locally stored model/index data.
- Model download size, local storage use, and current execution location are visible.
- No silent local-to-cloud fallback; every network-backed action is distinguishable from local inference.
- Tests cover unsupported WebGPU, adapter failure, download failure, cancellation, storage quota failure, and explicit removal.
- Performance is measured on real target devices before making speed or minimum-device claims.

## Technical references

- MDN WebGPU API: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- Hugging Face Transformers.js WebGPU guide: https://huggingface.co/docs/transformers.js/main/guides/webgpu
- Transformers.js overview and task coverage: https://huggingface.co/docs/transformers.js/en/index
- WebLLM documentation: https://webllm.io/docs/

WebGPU is limited-availability and requires a secure context. Runtime support, available models, quantization formats, and device memory requirements must be validated for the exact versions we adopt.
