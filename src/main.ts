import './styles/main.css';
import { RailMLParser } from './parser/railml-parser';
import { TopologyBuilder } from './parser/topology-builder';
import { TrackNetwork } from './model/track-network';
import { BrakingModel } from './physics/braking-model';
import { TrainDynamics } from './physics/train-dynamics';
import { CanvasRenderer } from './renderer/canvas-renderer';
import { BrakingOverlay } from './renderer/braking-overlay';
import { AnimationController } from './animation/animation-controller';
import { TrainParameters, DEFAULT_TRAIN_PARAMS, TRAIN_PRESETS } from './types/train';
import { msToKmh } from './utils/math';
import { DEMO_RAILML, ROUTE_PRESETS, RoutePreset } from './data/demo-layout';

class Application {
  private renderer!: CanvasRenderer;
  private brakingOverlay!: BrakingOverlay;
  private network: TrackNetwork | null = null;
  private trainDynamics: TrainDynamics | null = null;
  private animController: AnimationController | null = null;
  private brakingModel: BrakingModel;
  private currentRoute: import('./types/topology').RouteSegment[] = [];
  private trainParams: TrainParameters;

  // UI elements
  private playBtn!: HTMLButtonElement;
  private speedValue!: HTMLElement;
  private posValue!: HTMLElement;
  private gradientValue!: HTMLElement;
  private brakeValue!: HTMLElement;
  private supervisionValue!: HTMLElement;
  private distTargetValue!: HTMLElement;
  private progressFill!: HTMLElement;
  private speedMultLabel!: HTMLElement;
  private canvasHint!: HTMLElement;
  private routeSelect!: HTMLSelectElement;
  private routeDescription!: HTMLElement;

  constructor() {
    this.trainParams = { ...DEFAULT_TRAIN_PARAMS };
    this.brakingModel = new BrakingModel(this.trainParams);
    this.buildUI();
    this.setupKeyboardShortcuts();

    // Auto-load demo
    this.loadDemo();
  }

  private buildUI(): void {
    const app = document.getElementById('app')!;
    app.innerHTML = '';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.innerHTML = `
      <div class="toolbar__title"><span>rail</span>ML Viewer</div>
      <div class="toolbar__spacer"></div>
    `;
    app.appendChild(toolbar);

    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn';
    loadBtn.textContent = 'Load railML';
    loadBtn.addEventListener('click', () => this.openFileDialog());
    toolbar.appendChild(loadBtn);

    const demoBtn = document.createElement('button');
    demoBtn.className = 'btn btn--primary';
    demoBtn.textContent = 'Load Demo';
    demoBtn.addEventListener('click', () => this.loadDemo());
    toolbar.appendChild(demoBtn);

    const fitBtn = document.createElement('button');
    fitBtn.className = 'btn btn--icon';
    fitBtn.innerHTML = '&#x2922;';
    fitBtn.title = 'Fit to view (F)';
    fitBtn.addEventListener('click', () => this.fitView());
    toolbar.appendChild(fitBtn);

    // Canvas area
    const canvasArea = document.createElement('div');
    canvasArea.className = 'canvas-area';
    app.appendChild(canvasArea);

    this.canvasHint = document.createElement('div');
    this.canvasHint.className = 'canvas-area__hint';
    this.canvasHint.innerHTML = '<h2>No Track Layout Loaded</h2><p>Click "Load Demo" or drag a .railml file here</p>';
    canvasArea.appendChild(this.canvasHint);

    this.renderer = new CanvasRenderer(canvasArea);

    // Setup drag & drop
    canvasArea.addEventListener('dragover', (e) => { e.preventDefault(); });
    canvasArea.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => this.loadRailML(reader.result as string);
        reader.readAsText(file);
      }
    });

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';
    app.appendChild(sidebar);

    // Route selection panel
    const routePanel = document.createElement('div');
    routePanel.className = 'panel';
    routePanel.innerHTML = `
      <div class="panel__title">Route Service</div>
      <div style="margin-bottom: 8px;">
        <select id="route-select">
          ${ROUTE_PRESETS.map((p, i) =>
            `<option value="${i}"${i === 0 ? ' selected' : ''}>${p.name}</option>`
          ).join('')}
        </select>
      </div>
      <div id="route-description" style="font-size: 11px; color: var(--text-secondary, #94a3b8); line-height: 1.4;">
        ${ROUTE_PRESETS[0].description}
      </div>
    `;
    sidebar.appendChild(routePanel);

    this.routeSelect = routePanel.querySelector('#route-select') as HTMLSelectElement;
    this.routeDescription = routePanel.querySelector('#route-description')!;

    this.routeSelect.addEventListener('change', () => {
      const preset = ROUTE_PRESETS[parseInt(this.routeSelect.value)];
      if (preset) {
        this.routeDescription.textContent = preset.description;
        this.applyRoutePreset(preset);
      }
    });

    // Braking chart
    const chartContainer = document.createElement('div');
    chartContainer.className = 'braking-chart';
    const chartTitle = document.createElement('div');
    chartTitle.className = 'panel__title';
    chartTitle.style.padding = '10px 14px 0';
    chartTitle.textContent = 'ETCS Braking Curves';
    sidebar.appendChild(chartTitle);
    sidebar.appendChild(chartContainer);
    this.brakingOverlay = new BrakingOverlay(chartContainer);

    // Info panel
    const infoPanel = document.createElement('div');
    infoPanel.className = 'panel';
    infoPanel.innerHTML = `
      <div class="panel__title">Train Status</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-item__label">Speed</span>
          <span class="info-item__value" id="info-speed">0 km/h</span>
        </div>
        <div class="info-item">
          <span class="info-item__label">Position</span>
          <span class="info-item__value" id="info-pos">0 m</span>
        </div>
        <div class="info-item">
          <span class="info-item__label">Gradient</span>
          <span class="info-item__value" id="info-gradient">0 ‰</span>
        </div>
        <div class="info-item">
          <span class="info-item__label">Dist to Target</span>
          <span class="info-item__value" id="info-dist-target">— m</span>
        </div>
        <div class="info-item info-item--full">
          <span class="info-item__label">Brake Mode</span>
          <span class="info-item__value" id="info-brake">None</span>
        </div>
        <div class="info-item info-item--full">
          <span class="info-item__label">Supervision</span>
          <span id="info-supervision"></span>
        </div>
      </div>
    `;
    sidebar.appendChild(infoPanel);

    this.speedValue = infoPanel.querySelector('#info-speed')!;
    this.posValue = infoPanel.querySelector('#info-pos')!;
    this.gradientValue = infoPanel.querySelector('#info-gradient')!;
    this.distTargetValue = infoPanel.querySelector('#info-dist-target')!;
    this.brakeValue = infoPanel.querySelector('#info-brake')!;
    this.supervisionValue = infoPanel.querySelector('#info-supervision')!;

    // Parameter panel
    const paramPanel = document.createElement('div');
    paramPanel.className = 'panel';
    paramPanel.innerHTML = `
      <div class="panel__title">Braking Parameters</div>
      <div style="margin-bottom: 10px;">
        <select id="preset-select">
          <option value="custom">Custom</option>
          ${Object.keys(TRAIN_PRESETS).map(name =>
            `<option value="${name}">${name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="param-row">
        <div class="param-row__header">
          <span class="param-row__label">Service Brake (m/s²)</span>
          <span class="param-row__value" id="val-service">${this.trainParams.serviceBrakeDecel.toFixed(2)}</span>
        </div>
        <input type="range" id="param-service" min="0.2" max="1.5" step="0.05" value="${this.trainParams.serviceBrakeDecel}">
      </div>
      <div class="param-row">
        <div class="param-row__header">
          <span class="param-row__label">Emergency Brake (m/s²)</span>
          <span class="param-row__value" id="val-emergency">${this.trainParams.emergencyBrakeDecel.toFixed(2)}</span>
        </div>
        <input type="range" id="param-emergency" min="0.4" max="2.0" step="0.05" value="${this.trainParams.emergencyBrakeDecel}">
      </div>
      <div class="param-row">
        <div class="param-row__header">
          <span class="param-row__label">Reaction Time (s)</span>
          <span class="param-row__value" id="val-reaction">${this.trainParams.reactionTimeService.toFixed(1)}</span>
        </div>
        <input type="range" id="param-reaction" min="1.0" max="8.0" step="0.5" value="${this.trainParams.reactionTimeService}">
      </div>
      <div class="param-row">
        <div class="param-row__header">
          <span class="param-row__label">Max Speed (km/h)</span>
          <span class="param-row__value" id="val-maxspeed">${msToKmh(this.trainParams.maxSpeed).toFixed(0)}</span>
        </div>
        <input type="range" id="param-maxspeed" min="30" max="350" step="10" value="${msToKmh(this.trainParams.maxSpeed).toFixed(0)}">
      </div>
      <div class="param-row">
        <div class="param-row__header">
          <span class="param-row__label">Rotating Mass Factor</span>
          <span class="param-row__value" id="val-rotmass">${this.trainParams.rotatingMassFactor.toFixed(2)}</span>
        </div>
        <input type="range" id="param-rotmass" min="1.00" max="1.15" step="0.01" value="${this.trainParams.rotatingMassFactor}">
      </div>
    `;
    sidebar.appendChild(paramPanel);

    // Setup parameter change handlers
    this.setupParamHandlers(paramPanel);

    // Controls bar
    const controlsBar = document.createElement('div');
    controlsBar.className = 'controls-bar';
    app.appendChild(controlsBar);

    const playGroup = document.createElement('div');
    playGroup.className = 'controls-bar__group';
    controlsBar.appendChild(playGroup);

    this.playBtn = document.createElement('button');
    this.playBtn.className = 'btn btn--icon';
    this.playBtn.innerHTML = '&#9654;';
    this.playBtn.title = 'Play/Pause (Space)';
    this.playBtn.addEventListener('click', () => this.togglePlay());
    playGroup.appendChild(this.playBtn);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn btn--icon';
    stopBtn.innerHTML = '&#9632;';
    stopBtn.title = 'Stop (R)';
    stopBtn.addEventListener('click', () => this.stop());
    playGroup.appendChild(stopBtn);

    const stepBtn = document.createElement('button');
    stepBtn.className = 'btn btn--icon';
    stepBtn.innerHTML = '&#9197;';
    stepBtn.title = 'Step (S)';
    stepBtn.addEventListener('click', () => this.step());
    playGroup.appendChild(stepBtn);

    const sep = document.createElement('div');
    sep.className = 'controls-bar__separator';
    controlsBar.appendChild(sep);

    // Speed control
    const speedControl = document.createElement('div');
    speedControl.className = 'speed-control';
    speedControl.innerHTML = `
      <span class="param-row__label">Speed:</span>
      <input type="range" id="speed-mult" min="0.1" max="10" step="0.1" value="1">
      <span class="speed-control__label" id="speed-mult-label">1.0x</span>
    `;
    controlsBar.appendChild(speedControl);

    const speedSlider = speedControl.querySelector('#speed-mult') as HTMLInputElement;
    this.speedMultLabel = speedControl.querySelector('#speed-mult-label')!;
    speedSlider.addEventListener('input', () => {
      const val = parseFloat(speedSlider.value);
      this.speedMultLabel.textContent = `${val.toFixed(1)}x`;
      if (this.animController) this.animController.setSpeed(val);
    });

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'progress-bar';
    progress.innerHTML = '<div class="progress-bar__fill" id="progress-fill"></div>';
    controlsBar.appendChild(progress);
    this.progressFill = progress.querySelector('#progress-fill')!;
  }

  private setupParamHandlers(panel: HTMLElement): void {
    const presetSelect = panel.querySelector('#preset-select') as HTMLSelectElement;
    const serviceInput = panel.querySelector('#param-service') as HTMLInputElement;
    const emergencyInput = panel.querySelector('#param-emergency') as HTMLInputElement;
    const reactionInput = panel.querySelector('#param-reaction') as HTMLInputElement;
    const maxspeedInput = panel.querySelector('#param-maxspeed') as HTMLInputElement;
    const rotmassInput = panel.querySelector('#param-rotmass') as HTMLInputElement;

    const serviceVal = panel.querySelector('#val-service')!;
    const emergencyVal = panel.querySelector('#val-emergency')!;
    const reactionVal = panel.querySelector('#val-reaction')!;
    const maxspeedVal = panel.querySelector('#val-maxspeed')!;
    const rotmassVal = panel.querySelector('#val-rotmass')!;

    const updateParams = () => {
      this.trainParams.serviceBrakeDecel = parseFloat(serviceInput.value);
      this.trainParams.emergencyBrakeDecel = parseFloat(emergencyInput.value);
      this.trainParams.reactionTimeService = parseFloat(reactionInput.value);
      this.trainParams.reactionTimeEmergency = parseFloat(reactionInput.value) * 0.5;
      this.trainParams.maxSpeed = parseFloat(maxspeedInput.value) / 3.6;
      this.trainParams.rotatingMassFactor = parseFloat(rotmassInput.value);

      serviceVal.textContent = parseFloat(serviceInput.value).toFixed(2);
      emergencyVal.textContent = parseFloat(emergencyInput.value).toFixed(2);
      reactionVal.textContent = parseFloat(reactionInput.value).toFixed(1);
      maxspeedVal.textContent = parseFloat(maxspeedInput.value).toFixed(0);
      rotmassVal.textContent = parseFloat(rotmassInput.value).toFixed(2);

      this.brakingModel.updateParams(this.trainParams);
      if (this.trainDynamics) {
        this.trainDynamics.updateParams(this.trainParams);
      }
    };

    serviceInput.addEventListener('input', () => { presetSelect.value = 'custom'; updateParams(); });
    emergencyInput.addEventListener('input', () => { presetSelect.value = 'custom'; updateParams(); });
    reactionInput.addEventListener('input', () => { presetSelect.value = 'custom'; updateParams(); });
    maxspeedInput.addEventListener('input', () => { presetSelect.value = 'custom'; updateParams(); });
    rotmassInput.addEventListener('input', () => { presetSelect.value = 'custom'; updateParams(); });

    presetSelect.addEventListener('change', () => {
      const preset = TRAIN_PRESETS[presetSelect.value];
      if (preset) {
        this.trainParams = { ...preset };
        serviceInput.value = String(preset.serviceBrakeDecel);
        emergencyInput.value = String(preset.emergencyBrakeDecel);
        reactionInput.value = String(preset.reactionTimeService);
        maxspeedInput.value = String(msToKmh(preset.maxSpeed).toFixed(0));
        rotmassInput.value = String(preset.rotatingMassFactor);
        updateParams();
      }
    });
  }

  private loadDemo(): void {
    this.loadRailML(DEMO_RAILML);
  }

  private openFileDialog(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,.railml';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => this.loadRailML(reader.result as string);
        reader.readAsText(file);
      }
    });
    input.click();
  }

  private loadRailML(xml: string): void {
    try {
      const parser = new RailMLParser();
      const infra = parser.parse(xml);

      const builder = new TopologyBuilder();
      const { nodes, edges } = builder.build(infra);

      this.network = new TrackNetwork(nodes, edges, infra.stations);
      this.renderer.setNetwork(this.network);

      // Apply the selected route preset (or default to full line)
      const presetIndex = this.routeSelect ? parseInt(this.routeSelect.value) : 0;
      const preset = ROUTE_PRESETS[presetIndex] || ROUTE_PRESETS[0];
      const route = this.network.generateRouteBetweenStations(
        preset.fromStationId,
        preset.toStationId
      );
      this.currentRoute = route;
      const routeEdgeIds = route.map(r => r.edgeId);
      this.renderer.setRouteHighlight(routeEdgeIds);

      if (this.routeSelect) {
        this.routeSelect.value = String(presetIndex);
        this.routeDescription.textContent = preset.description;
      }

      this.trainDynamics = new TrainDynamics(this.trainParams, this.network, this.brakingModel);
      this.trainDynamics.setRoute(route);

      this.animController = new AnimationController(
        this.trainDynamics,
        this.renderer,
        this.brakingOverlay,
      );

      this.animController.setOnFrame(() => this.updateInfoPanel());

      // Initial render
      this.animController.renderFrame();
      this.canvasHint.style.display = 'none';

      console.log(`Loaded: ${infra.tracks.length} tracks, ${infra.signals.length} signals, ${infra.switches.length} switches`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to parse railML:', msg, err);
      alert('Failed to parse railML file: ' + msg);
    }
  }

  private applyRoutePreset(preset: RoutePreset): void {
    if (!this.network || !this.trainDynamics || !this.animController) return;

    this.animController.stop();

    const route = this.network.generateRouteBetweenStations(
      preset.fromStationId,
      preset.toStationId
    );

    this.currentRoute = route;
    const routeEdgeIds = route.map(r => r.edgeId);
    this.renderer.setRouteHighlight(routeEdgeIds);

    this.trainDynamics.setRoute(route);
    this.animController.renderFrame();
    this.updateInfoPanel();
    this.playBtn.innerHTML = '&#9654;';
  }

  private togglePlay(): void {
    if (!this.animController) return;
    const state = this.animController.getState();
    if (state.isPlaying) {
      this.animController.pause();
      this.playBtn.innerHTML = '&#9654;';
    } else {
      this.animController.play();
      this.playBtn.innerHTML = '&#9646;&#9646;';
    }
  }

  private stop(): void {
    if (!this.animController) return;
    this.animController.stop();
    this.playBtn.innerHTML = '&#9654;';
  }

  private step(): void {
    if (!this.animController) return;
    this.animController.step();
  }

  private fitView(): void {
    this.renderer.fitToView();
    if (this.animController) this.animController.renderFrame();
    else this.renderer.render();
  }

  private updateInfoPanel(): void {
    if (!this.trainDynamics) return;

    const state = this.trainDynamics.getState();
    const routeLen = this.trainDynamics.getRouteTotalLength();

    this.speedValue.textContent = `${msToKmh(state.speed).toFixed(1)} km/h`;
    this.posValue.textContent = `${state.totalDistance.toFixed(0)} m`;
    this.distTargetValue.textContent = `${state.distanceToTarget.toFixed(0)} m`;

    // Gradient (approximate from current edge)
    const routeSeg = this.currentRoute[state.routeEdgeIndex];
    const edgeId = routeSeg?.edgeId || '';
    const seg = this.network?.getEdge(edgeId);
    const grad = seg ? this.network!.getGradientAt(seg.id, state.edgeOffset) : 0;
    this.gradientValue.textContent = `${grad >= 0 ? '+' : ''}${grad.toFixed(1)} ‰`;

    // Brake mode
    const brakeLabels: Record<string, string> = {
      none: 'None',
      service: 'Service',
      emergency: 'Emergency',
    };
    this.brakeValue.textContent = brakeLabels[state.brakeMode] || 'None';
    this.brakeValue.style.color = state.brakeMode === 'emergency' ? '#fc5c65'
      : state.brakeMode === 'service' ? '#ed8936' : '#e2e8f0';

    // Supervision status
    this.supervisionValue.innerHTML = `
      <span class="status-badge status-badge--${state.supervisionStatus}">
        <span class="status-badge__dot"></span>
        ${state.supervisionStatus.charAt(0).toUpperCase() + state.supervisionStatus.slice(1)}
      </span>
    `;

    // Progress
    const progress = routeLen > 0 ? (state.totalDistance / routeLen) * 100 : 0;
    this.progressFill.style.width = `${Math.min(100, progress)}%`;

    // Update play button if finished
    if (this.trainDynamics.isFinished()) {
      this.playBtn.innerHTML = '&#9654;';
    }
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.togglePlay();
          break;
        case 's':
          this.step();
          break;
        case 'r':
          this.stop();
          break;
        case 'f':
          this.fitView();
          break;
        case '+':
        case '=':
          if (this.animController) {
            const state = this.animController.getState();
            const newSpeed = Math.min(10, state.speedMultiplier + 0.5);
            this.animController.setSpeed(newSpeed);
            this.speedMultLabel.textContent = `${newSpeed.toFixed(1)}x`;
            const slider = document.getElementById('speed-mult') as HTMLInputElement;
            if (slider) slider.value = String(newSpeed);
          }
          break;
        case '-':
          if (this.animController) {
            const state = this.animController.getState();
            const newSpeed = Math.max(0.1, state.speedMultiplier - 0.5);
            this.animController.setSpeed(newSpeed);
            this.speedMultLabel.textContent = `${newSpeed.toFixed(1)}x`;
            const slider = document.getElementById('speed-mult') as HTMLInputElement;
            if (slider) slider.value = String(newSpeed);
          }
          break;
      }
    });
  }
}

// Start the application
new Application();
