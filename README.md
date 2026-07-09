# Blueprint Protocol

**A didactic protocol for thinking, learning, and decision-making in the age of generative AI.**

Two documents. One protocol, one implementation specification.

-----

## The Problem

Generative AI produces plausible-looking text, arguments, and solutions without any underlying understanding. Classical education formats — essays, exams, term papers — were designed to assess reasoning. They no longer do. The result is epistemic inflation: outputs that look like knowledge but aren’t traceable, revisable, or accountable.

Blueprint does not respond to this by banning AI. It responds by making thinking itself formal and verifiable.

-----

## What’s in this Repository

### `Blueprint_Project.pdf` — The Protocol

Blueprint is a **didactic protocol**, not a tool. It formalizes the thinking process by requiring explicit goals, scope definitions, concept definitions, assumptions, typed claims, dependency structures, counter-tests, uncertainty zones, and revisable conclusions.

Every central statement is treated as a claim with:

- A type (empirical, logical, normative, operative, hypothetical)
- An epistemic status (secure, probable, uncertain, speculative)
- Explicit dependencies
- A revision history

Assessment shifts from final answers to justification processes, structural coherence, and revision quality. AI is integrated under strict role separation — as exploration tool, precision tool, and adversarial stress tester — while human epistemic responsibility is preserved.

### `Blueprint_Studio.pdf` — The Implementation Specification

Blueprint Studio is the technical companion: a functional specification for an **epistemic authoring tool** that implements the Blueprint protocol.

It is block-based, not page-based. It functions as a **compiler for thinking**, not a text editor. A blueprint cannot be saved unless all mandatory modules are structurally valid. A claim without epistemic status is invalid. An assumption without justification is inadmissible. A decision without a dependency graph cannot be submitted.

The specification covers:

- Claim graph with typed nodes and dependency tracking
- Revision logic with full history preservation
- AI integration architecture (role-separated, not autonomous)
- Assessment and certification pipeline
- A three-phase roadmap toward a knowledge economy where certified blueprints become licensable structured knowledge artifacts

-----

## Implementation Status

**A working MVP implementation now lives in [`blueprint-studio/`](./blueprint-studio/)** — a local desktop app (Windows `.exe` installer, macOS `.dmg`) implementing the core of the specification: the claim graph editor, mandatory-block scaffolding, the validation compiler with gate logic, the Δ-log with enforced change rationales, immutable snapshots, the cascade ("tremor") system, and the three role-separated AI modes (exploration / precision / adversarial) with mandatory attack responses. Installers are built by GitHub Actions (`Blueprint Studio — Build Installers` workflow); see [`blueprint-studio/README.md`](./blueprint-studio/README.md) for details.

An earlier attempt to build this with LLM assistance failed. The specification proved complete and detailed enough to serve as a serious engineering brief — which is exactly how it was used. If you want to extend it (consolidation engine, certification workflow, multi-user), the spec's phase 2+ roadmap is the map. No conditions, no equity claims, no strings attached. The goal is that this exists, not that I own it.

-----

## Relation to Alexandria and the Dual-Layer Economy

Blueprint Protocol is part of a broader set of interconnected frameworks:

- **[Alexandria Protocol](https://github.com/[username]/alexandria-protocol)** — epistemic infrastructure for tamper-proof knowledge lineage; provides the cryptographic anchoring layer that Blueprint-certified knowledge would require for manipulation-resistant attribution and monetization
- **[Dual-Layer Economy](https://ssrn.com)** [link to be added] — macroeconomic architecture separating speculative finance from the real economy within ecological limits; Blueprint-certified knowledge enters the real economy layer as a public good

Blueprint produces the structured knowledge. Alexandria anchors it immutably. The DLE provides the economic architecture for its sustainable flow.

-----

## Contact

H.-Steffen Rentschler
Independent researcher
SSRN author page:  

-----

## License

MIT. Use freely, build seriously, cite honestly.
