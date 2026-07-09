# Blueprint Studio

**Epistemische Werkbank nach dem Blueprint-Protokoll** — eine lokal installierbare Desktop-App
für Windows und macOS (Linux als Bonus). Kein Cloud-Zwang: alle Daten bleiben auf dem eigenen Rechner.

Blueprint Studio ist kein Texteditor, sondern ein **Compiler für Denken**: Ein Blueprint lässt sich
erst einreichen, wenn alle Pflichtmodule formal gültig sind. Ein Claim ohne Status ist ungültig,
eine Annahme ohne Begründung unzulässig, ein unbeantworteter Angriff blockiert die Zertifizierung.

## Installation (Endnutzer)

Die Installer werden von GitHub Actions gebaut (Workflow „Blueprint Studio — Build Installers“):

- **Windows**: `Blueprint Studio Setup x.y.z.exe` (NSIS-Installer) herunterladen und ausführen.
  Windows SmartScreen: „Weitere Informationen“ → „Trotzdem ausführen“ (Build ist nicht signiert).
- **macOS**: `Blueprint Studio-x.y.z-universal.dmg` öffnen, App in „Programme“ ziehen.
  Erster Start: Rechtsklick → „Öffnen“ (Build ist nicht notariell beglaubigt).

Artefakte: bei jedem Push unter *Actions → Run → Artifacts*; bei Tags `studio-v*` als GitHub Release.

## Was die App umsetzt (MVP nach Spezifikation)

| Spec-Baustein | Umsetzung |
|---|---|
| Epistemic Scaffolding | 8 Pflichtblöcke mit Live-Status im Strukturpanel (links) |
| Epistemische Arena | Graph-Editor (React Flow): typisierte Knoten, gerichtete, typisierte Kanten |
| Claim-Disziplin | Typ (E/L/N/O/H), Status (S/W/U/X), Status-Begründung und Scope sind Pflichtfelder |
| Kaskadenlogik („Tremor“) | Substanzielle Claim-Änderung stuft abhängige Claims automatisch herab (S→W→U), visuell markiert, im Δ-Log protokolliert |
| Validierungs-Compiler | Deterministisch: fehlende Blöcke, Claim ohne Typ/Status/Scope/Begründung, offene Angriffe, Zirkelschlüsse, ungestützte Ergebnisse, „gesichert vs. gesichert“-Widersprüche |
| Δ-Log | Jede strukturelle Änderung erzwingt eine Begründung; Timeline mit Filtern (rechts unten) |
| Snapshots | „Commit“ friert unveränderliche Revisionsstände ein (R-01 …), mit inhaltsstabilem Hash |
| KI-Modi | Exklusiver Umschalter: Exploration (Material, nie Claims) · Präzision (Strukturprüfung) · Adversarial (Angriffe mit Antwortpflicht: präzisieren / verteidigen / aufgeben) |
| Peer-Angriffe | Manuell erfassbar, gleiche Antwortpflicht wie KI-Angriffe |
| Gate-Logik | Einreichen/Validieren/Zertifizieren nur bei grünem Compiler; Einreichung erzeugt automatisch einen Snapshot |
| Export | PDF-Report (Claim-Liste, Angriffe, Δ-Log, Snapshot-Hash) und maschinenlesbares JSON („Explanation View“) |

**KI-Rollentrennung:** Ohne Konfiguration arbeitet der Adversarial-Modus mit einer eingebauten,
deterministischen Angriffs-Engine (offline, regelbasiert — LLM für Sprache wäre optional, Regeln
für Logik immer). In den Einstellungen (⚙︎ auf der Startseite) kann ein OpenAI-kompatibler
Endpunkt hinterlegt werden; das LLM formuliert dann Angriffe, entscheidet aber nie: Es erzeugt
nur strukturierte AttackStates, niemals Urteile, Status oder Claims.

## Entwicklung

```bash
cd blueprint-studio
npm install          # in Umgebungen ohne GitHub-Zugriff: ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
npm run dev          # Electron mit Hot Reload
npm test             # Kernlogik-Tests (Compiler, Kaskade, Angriffs-Engine, Hashing)
npm run typecheck
npm run dist:mac     # .dmg  (auf macOS)
npm run dist:win     # .exe  (auf Windows)
```

UI-Smoke-Test ohne Electron (der Renderer fällt auf localStorage zurück):

```bash
npm run build
python3 -m http.server 8123 --directory out/renderer &
CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/ui-smoke.mjs
```

## Architektur

```
src/shared/     Domänenmodell + gesamte Logik (rein, deterministisch, getestet)
  types.ts        Datenmodell nach Spec v1.0 (Nodes, Edges, AttackState, Δ-Log, Snapshot)
  validation.ts   der Compiler (blockierende Fehler + Warnungen)
  cascade.ts      Tremor-System (Status-Downgrade entlang supports/requires)
  attacks.ts      deterministische Adversarial-Engine
  graph.ts        Abhängigkeits-Traversierung, Zykluserkennung, stabiler Content-Hash
src/main/       Electron-Hauptprozess: JSON-Storage (atomar), PDF/JSON-Export, optionaler LLM-Adapter
src/preload/    typisierte IPC-Brücke (contextIsolation)
src/renderer/   React-UI: Strukturpanel · Arena · KI-Panel · Δ-Log · Compiler-Leiste
```

Grundsatz aus dem Protokoll, im Code durchgehalten: **Der Graph ist die Quelle der Wahrheit,
Validierung ist ein Compiler, KI ist Plugin — nie Autorität.** Es gibt bewusst keinen Code-Pfad,
über den eine KI einen Claim setzt, einen Status vergibt oder ein Gate öffnet.

## Lizenz

MIT — siehe [LICENSE](./LICENSE).
