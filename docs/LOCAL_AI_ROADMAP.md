# Local AI and model-provider roadmap

## Product decision

Breezy Research remains **single-model**: one configured Research model is used for each research run, with one answer-generation call. The app may support different ways to host that model, but those are provider connections—not Research modes, agent teams, or multi-round workflows.

The Research screen should always show the actual configured provider/model and explain the one-call workflow. It must not show Solo/Trio/Deep selectors or imply that a local runtime silently replaces the configured model.

Local AI should be introduced incrementally as an optional provider capability. This is not a promise that every device can run every model, that inference is always faster, or that every task can run offline from first launch.

## Provider options

Treat these as separate adapters behind a small, explicit model-provider interface. Each adapter reports whether it is configured, reachable, supported, and ready. Only one provider/model is selected for a given Research run.

### 1. In-browser WebGPU

The model runs in the browser on the user's device. Model files are downloaded to browser-managed storage, and inference uses the browser's WebGPU implementation when available.

- This is the closest fit for a website that can run AI without a separate installed inference app.
- WebGPU requires a secure context and has limited browser/device availability. `navigator.gpu` existing is not enough: Breezy must request an adapter and device and test actual model initialization.
- Browser support does not guarantee enough memory, a compatible model/runtime, or acceptable speed. Test representative low-memory Android phones as well as desktop devices.
- Start with small local embeddings and document retrieval; evaluate local text generation only after a proof of concept.
- Use a Web Worker where supported, lazy-load the runtime, and make downloads explicit, cancellable, measurable, and removable.

### 2. Ollama on a user's computer

Ollama runs as a separate local service; Breezy's browser connects to it over HTTP. This can support models that are impractical to run in the browser, but it is not inference inside the website.

- Require the user to install and start Ollama and explicitly connect it. Show connection status and the selected model.
- A hosted Breezy page cannot assume the local service is available. The user may need to allow Breezy's origin using Ollama's `OLLAMA_ORIGINS` configuration.
- Keep Ollama bound to loopback by default; do not instruct users to expose the service publicly or across a network without a deliberate, secure setup.
- Handle CORS, browser local-network restrictions, mixed-content behavior, timeouts, and connection refusal as normal failure states.
- Test the exact hosted origin and supported browsers before claiming the integration works.
- Never send prompts to a cloud provider automatically if the local service is offline.

### 3. Mobile-hosted models (PocketPal or compatible app)

A mobile app can run a model on the phone's CPU, GPU, or NPU independently of the browser. That does **not** automatically make the model callable from a webpage.

- PocketPal's public project describes on-device GGUF inference, but this roadmap does not assume it exposes a stable HTTP/OpenAI-compatible API for other apps to call.
- First verify whether a supported API or intentional integration mechanism exists. If not, do not fake a “Connect PocketPal” button or attempt undocumented private interfaces.
- If a compatible API becomes available, build and test a dedicated adapter with explicit pairing/connection steps, permissions, timeouts, and clear local-network/privacy warnings.
- Otherwise, treat PocketPal as a separate app/reference implementation, not a supported Breezy provider. A future native Breezy app could evaluate embedding an on-device runtime directly.
- A phone's local model must not be exposed to the public internet merely to make a hosted webpage connect to it.

## Important current architecture boundary

The current Research pipeline performs search, source retrieval, and model generation through the backend route. The existing server-side Ollama configuration points to an Ollama service reachable **from the backend**, not automatically to Ollama installed on each user's computer. A hosted backend cannot reach a user's `localhost`.

Likewise, WebGPU inference cannot be enabled by merely adding a provider name to the server-side provider list. To support a browser-local Research model while keeping the one-call contract, Breezy would need a deliberate client-side generation path: the backend performs the existing search/retrieval work, then the browser receives the bounded research context and makes exactly one call to its selected local model. The UI must be explicit that the research question is still sent to Breezy's backend for search/retrieval; this design must not be advertised as fully offline or fully private.

Before claiming that Ollama or PocketPal is a working user-local Research provider, verify the complete request path from the deployed website through generation and prove where inference actually executes. The existing provider label/configuration alone is not proof.

## Why local AI fits Breezy

- **Cost control:** after a model is downloaded or installed, supported inference can run without per-token API charges. Model hosting/download bandwidth and development still have costs.
- **Privacy:** local inference can keep task inputs on-device. The UI must say precisely which operations stay local; web search, account sync, bug reports, and other server features may still send data elsewhere.
- **Progressive enhancement:** Breezy remains usable when WebGPU is unavailable, local services are stopped, memory is limited, or a model fails to load.
- **User control:** never download multi-hundred-megabyte or multi-gigabyte model files without an explicit action. Show model size, storage use, download progress, cancellation, and removal controls.
- **Honest behavior:** no silent switch between local and cloud providers. If the selected provider is unavailable, explain why and let the user choose another provider or stop.

## Recommended implementation order

### Phase 0 — provider contract and capability spike

1. Define a small provider contract for readiness, model identity, generation, cancellation, and errors. Keep provider selection outside the Research workflow logic.
2. Verify WebGPU secure-context support, adapter/device initialization, worker support, and browser storage.
3. Trace and test the current Ollama request path; separate backend-hosted Ollama from an explicitly user-local browser connection.
4. Design the client-side generation handoff so search/retrieval stays intact and exactly one answer-generation call is made.
5. Investigate PocketPal's supported integration surface. Do not implement an adapter until a documented, stable connection path is confirmed.
6. Report unsupported, unconfigured, connecting, downloading, ready, failed, and disconnected states truthfully.
7. Keep runtimes behind narrow adapters and lazy-load browser-local code so normal Breezy startup does not pay the bundle cost.

### Phase 1 — local embeddings and document retrieval

Start here because it helps Breezy's document workflow and is generally lighter than local text generation.

- Evaluate Transformers.js with a small supported embedding model on WebGPU, with CPU/WASM fallback only when practical.
- Embed user-selected local documents in a Web Worker and keep vectors and source chunks in IndexedDB.
- Search the local index for relevant passages; show the source filename and matching excerpt.
- Make local indexing opt-in and provide per-document deletion plus clear-index controls.
- Keep local documents out of backend requests unless the user explicitly chooses a server-backed action.
- Measure first-download size, peak memory, latency, retrieval quality, cancellation, and recovery from quota/storage errors.

### Phase 2 — optional local text generation

- Prototype one small, permissively licensed instruct model with WebLLM/MLC-LLM or another runtime after testing device coverage.
- Add user-local Ollama only after the browser-to-local-service connection and security behavior have been tested.
- Keep provider choice explicit. Research still performs one answer-generation call with the single configured Research model, regardless of whether that model is remote or local.
- Use a Web Worker where applicable, cancellable generation, bounded context, and a clear model download/removal lifecycle.
- Clearly label output as locally generated and explain that model capability and speed vary.
- If the selected provider is unavailable, offer an explicit choice to retry, configure another provider, or stop. Never auto-fallback.

### Phase 3 — speech and other modalities

Only after embeddings and text generation are stable, evaluate speech-to-text, text-to-speech, and image tasks independently. Each has different model sizes, runtime support, performance, and privacy implications. Do not bundle every modality into the first release.

## Non-goals for the first release

- No automatic 1B–9B model downloads.
- No claim that 30–100 tokens/second or 1–4 second image generation is typical.
- No assumption that Firefox, Safari, Android browsers, or embedded WebViews have equivalent WebGPU support.
- No cloud fallback without a clear user choice.
- No extra LLM calls or selectable multi-agent modes in Research.
- No mixing local-runtime status into Research's configured-model indicator.
- No uploading private local documents merely to make local retrieval work.
- No public exposure of a user's local inference server to support a convenience integration.

## Acceptance criteria

- Research shows the actual configured model/provider and clearly explains its one-call workflow.
- Provider selection does not add extra model calls or imply multiple Research modes.
- WebGPU checks secure context and actually attempts adapter/device initialization.
- No model files download until the user explicitly starts a download.
- Unsupported browsers and disconnected local services receive clear explanations; the rest of Breezy still works.
- The user can cancel downloads/generation and remove locally stored model/index data.
- Model download size, local storage use, and current execution location are visible.
- Every network-backed action is distinguishable from local inference; no silent local-to-cloud fallback.
- Tests cover unsupported WebGPU, adapter failure, download/connection failure, cancellation, storage quota failure, explicit removal, and exactly one Research generation call.
- Performance is measured on real target devices before making speed or minimum-device claims.

## Technical references

- MDN WebGPU API: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- Hugging Face Transformers.js WebGPU guide: https://huggingface.co/docs/transformers.js/main/guides/webgpu
- Transformers.js overview and task coverage: https://huggingface.co/docs/transformers.js/en/index
- WebLLM documentation: https://webllm.io/docs/
- Ollama FAQ (network binding and allowed origins): https://github.com/ollama/ollama/blob/main/docs/faq.mdx
- PocketPal AI project: https://github.com/a-ghorbani/pocketpal-ai

WebGPU is limited-availability and requires a secure context. Runtime support, available models, quantization formats, and device memory requirements must be validated for the exact versions we adopt. PocketPal is not a supported Breezy provider unless a documented integration surface is verified.
