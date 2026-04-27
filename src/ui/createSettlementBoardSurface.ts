import { getRadialSitePoint } from "../game/board/radialTopology";
import { getSelectedBuildStructureId } from "../game/selectors";
import { GameStore } from "../game/state/gameStore";
import type { BoardCell, GameState } from "../game/state/types";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_SIZE = 960;
const CENTER = { x: 480, y: 480 };
const RADIAL_SCALE = 138;
const DRAG_THRESHOLD = 8;
const MAX_CONNECTIONS_PER_STRUCTURE = 3;

interface Point {
  x: number;
  y: number;
}

interface CellGeometry {
  point: Point;
  radius: number;
}

type ConnectionIdeologyClass = "tech" | "magic" | "hybrid" | null;

const STRUCTURE_SHORT_LABEL: Record<string, string> = {
  farm: "FA",
  mine: "MI",
  workshop: "WS",
  watchtower: "WT",
  well: "WE",
  "muster-hall": "MH"
};

function createSvgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | undefined> = {}
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) {
      continue;
    }

    element.setAttribute(key, `${value}`);
  }

  return element;
}

function getSiteRadius(cell: BoardCell): number {
  if (cell.ring <= 0) {
    return 38;
  }

  if (cell.ring === 1) {
    return 29;
  }

  if (cell.ring === 2) {
    return 24;
  }

  return 19;
}

function toBoardPoint(cell: Pick<BoardCell, "ring" | "sector">): Point {
  const radial = getRadialSitePoint(cell);
  return {
    x: CENTER.x + radial.x * RADIAL_SCALE,
    y: CENTER.y + radial.y * RADIAL_SCALE
  };
}

function buildCellGeometryMap(board: BoardCell[]): Map<string, CellGeometry> {
  return new Map(
    board.map((cell) => [
      cell.id,
      {
        point: toBoardPoint(cell),
        radius: getSiteRadius(cell)
      }
    ])
  );
}

function hasIdeologyTrait(cell: BoardCell, ideology: "tech" | "magic"): boolean {
  if (cell.appliedIdeologies.includes(ideology)) {
    return true;
  }

  return cell.appliedIdeology === ideology;
}

function getSharedConnectionTraits(left: BoardCell, right: BoardCell): Array<"tech" | "magic"> {
  const shared: Array<"tech" | "magic"> = [];

  if (hasIdeologyTrait(left, "tech") && hasIdeologyTrait(right, "tech")) {
    shared.push("tech");
  }

  if (hasIdeologyTrait(left, "magic") && hasIdeologyTrait(right, "magic")) {
    shared.push("magic");
  }

  return shared;
}

function getConnectionIdeologyClass(left: BoardCell, right: BoardCell): ConnectionIdeologyClass {
  const shared = getSharedConnectionTraits(left, right);

  if (shared.length >= 2) {
    return "hybrid";
  }

  return shared[0] ?? null;
}

function getCellAngle(cell: Pick<BoardCell, "ring" | "sector">): number {
  if (cell.ring <= 0) {
    return -Math.PI / 2;
  }

  const sectorCount = Math.max(1, cell.ring * 8);
  return (cell.sector / sectorCount) * Math.PI * 2 - Math.PI / 2;
}

function getPointAtPolar(angle: number, radius: number): Point {
  return {
    x: CENTER.x + Math.cos(angle) * radius,
    y: CENTER.y + Math.sin(angle) * radius
  };
}

function getCircularAngleDelta(fromAngle: number, toAngle: number): number {
  let delta = toAngle - fromAngle;

  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }

  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return delta;
}

function getTechPath(
  from: Point,
  to: Point,
  fromCell: Pick<BoardCell, "ring" | "sector">,
  toCell: Pick<BoardCell, "ring" | "sector">
): string {
  const fromAngle = getCellAngle(fromCell);
  const toAngle = getCellAngle(toCell);
  const laneRing = Math.max(1, Math.min(fromCell.ring, toCell.ring));
  const laneRadius =
    laneRing * RADIAL_SCALE +
    RADIAL_SCALE * 0.16 +
    Math.abs(fromCell.ring - toCell.ring) * RADIAL_SCALE * 0.11;
  const fromLane = getPointAtPolar(fromAngle, laneRadius);
  const toLane = getPointAtPolar(toAngle, laneRadius);

  return `M ${from.x} ${from.y} L ${fromLane.x} ${fromLane.y} L ${toLane.x} ${toLane.y} L ${to.x} ${to.y}`;
}

function getMagicPath(
  from: Point,
  to: Point,
  fromCell: Pick<BoardCell, "ring" | "sector">,
  toCell: Pick<BoardCell, "ring" | "sector">
): string {
  const fromAngle = getCellAngle(fromCell);
  const toAngle = getCellAngle(toCell);

  if (fromCell.ring === toCell.ring) {
    const radius = Math.max(1, fromCell.ring) * RADIAL_SCALE;
    const delta = getCircularAngleDelta(fromAngle, toAngle);
    const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta >= 0 ? 1 : 0;

    return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${to.x} ${to.y}`;
  }

  const midpointAngle = fromAngle + getCircularAngleDelta(fromAngle, toAngle) * 0.5;
  const controlRadius =
    (Math.max(fromCell.ring, toCell.ring) + 0.35) * RADIAL_SCALE;
  const controlPoint = getPointAtPolar(midpointAngle, controlRadius);

  return `M ${from.x} ${from.y} Q ${controlPoint.x} ${controlPoint.y} ${to.x} ${to.y}`;
}

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const rect = svg.getBoundingClientRect();
  const scale = Math.min(rect.width / VIEW_SIZE, rect.height / VIEW_SIZE);
  const renderedWidth = VIEW_SIZE * scale;
  const renderedHeight = VIEW_SIZE * scale;
  const insetX = (rect.width - renderedWidth) * 0.5;
  const insetY = (rect.height - renderedHeight) * 0.5;
  const svgX = scale > 0 ? (clientX - rect.left - insetX) / scale : 0;
  const svgY = scale > 0 ? (clientY - rect.top - insetY) / scale : 0;

  return {
    x: Math.max(0, Math.min(VIEW_SIZE, svgX)),
    y: Math.max(0, Math.min(VIEW_SIZE, svgY))
  };
}

function distance(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function canStartConnection(state: GameState, cell: BoardCell): boolean {
  return (
    state.phase === "build" &&
    !state.selectedCardInstanceId &&
    !state.selectedNodeStructureId &&
    !state.selectedIdeologyCard &&
    cell.terrain !== "core" &&
    cell.structureId !== null
  );
}

function getCellAtPoint(
  board: BoardCell[],
  geometryById: Map<string, CellGeometry>,
  point: Point
): BoardCell | null {
  let bestCell: BoardCell | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const cell of board) {
    const geometry = geometryById.get(cell.id);

    if (!geometry) {
      continue;
    }

    const nextDistance = distance(geometry.point, point);
    const hitRadius = geometry.radius + 8;

    if (nextDistance <= hitRadius && nextDistance < bestDistance) {
      bestDistance = nextDistance;
      bestCell = cell;
    }
  }

  return bestCell;
}

class SettlementBoardSurface {
  private readonly host: HTMLDivElement;
  private readonly svg: SVGSVGElement;
  private readonly store: GameStore;
  private unsubscribe?: () => void;
  private currentState: GameState;
  private geometryByCellId = new Map<string, CellGeometry>();
  private draftSourceCellId: string | null = null;
  private draftStartPoint: Point | null = null;
  private draftPointer: Point | null = null;
  private draftMoved = false;
  private pointerDownCellId: string | null = null;
  private hoveredCellId: string | null = null;

  constructor(parent: HTMLElement, store: GameStore) {
    this.store = store;
    this.currentState = store.getState();
    this.host = document.createElement("div");
    this.host.className = "svg-board-surface";
    this.svg = createSvgEl("svg", {
      class: "svg-board",
      viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`,
      role: "img",
      "aria-label": "Settlement radial board"
    });
    this.host.appendChild(this.svg);
    parent.innerHTML = "";
    parent.appendChild(this.host);

    this.svg.addEventListener("pointermove", this.handlePointerMove);
    this.svg.addEventListener("pointerleave", this.handlePointerLeave);
    window.addEventListener("pointerup", this.handlePointerUp);

    this.unsubscribe = store.subscribe((state) => {
      this.currentState = state;
      this.render(state);
    });
  }

  destroy(): void {
    this.unsubscribe?.();
    this.svg.removeEventListener("pointermove", this.handlePointerMove);
    this.svg.removeEventListener("pointerleave", this.handlePointerLeave);
    window.removeEventListener("pointerup", this.handlePointerUp);
  }

  private clearDraft(): void {
    this.draftSourceCellId = null;
    this.draftStartPoint = null;
    this.draftPointer = null;
    this.draftMoved = false;
    this.pointerDownCellId = null;
  }

  private evaluateDraftTarget(
    state: GameState,
    targetCell: BoardCell | null
  ): {
    valid: boolean;
    reason: string;
    target: BoardCell | null;
  } {
    if (!this.draftSourceCellId) {
      return {
        valid: false,
        reason: "Connection cancelled.",
        target: null
      };
    }

    const sourceCell =
      state.board.find((cell) => cell.id === this.draftSourceCellId) ?? null;

    if (!sourceCell || sourceCell.terrain === "core" || !sourceCell.structureId) {
      return {
        valid: false,
        reason: "Connection source must be a built non-core structure.",
        target: null
      };
    }

    if (!targetCell) {
      return {
        valid: false,
        reason: "Release on another built structure to create a connection.",
        target: null
      };
    }

    if (targetCell.id === sourceCell.id) {
      return {
        valid: false,
        reason: "A structure cannot connect to itself.",
        target: targetCell
      };
    }

    if (targetCell.terrain === "core" || !targetCell.structureId) {
      return {
        valid: false,
        reason: "Connections can only target built non-core structures.",
        target: targetCell
      };
    }

    const alreadyConnected = sourceCell.connections.some(
      (connection) => connection.toCellId === targetCell.id
    );

    if (alreadyConnected) {
      return {
        valid: true,
        reason: "Release to remove this existing connection.",
        target: targetCell
      };
    }

    if (sourceCell.connections.length >= MAX_CONNECTIONS_PER_STRUCTURE) {
      return {
        valid: false,
        reason: `Source is at max links (${MAX_CONNECTIONS_PER_STRUCTURE}).`,
        target: targetCell
      };
    }

    if (targetCell.connections.length >= MAX_CONNECTIONS_PER_STRUCTURE) {
      return {
        valid: false,
        reason: `Target is at max links (${MAX_CONNECTIONS_PER_STRUCTURE}).`,
        target: targetCell
      };
    }

    return {
      valid: true,
      reason: "Release to create a plain connection.",
      target: targetCell
    };
  }

  private handlePointerMove = (event: PointerEvent): void => {
    const point = getSvgPoint(this.svg, event.clientX, event.clientY);
    const hovered = getCellAtPoint(this.currentState.board, this.geometryByCellId, point);
    const nextHoveredId = hovered?.id ?? null;

    if (!this.draftSourceCellId || !this.draftStartPoint) {
      if (nextHoveredId !== this.hoveredCellId) {
        this.hoveredCellId = nextHoveredId;
        this.render(this.currentState);
      }

      return;
    }

    this.draftPointer = point;

    if (!this.draftMoved && distance(this.draftStartPoint, point) >= DRAG_THRESHOLD) {
      this.draftMoved = true;
    }

    this.hoveredCellId = nextHoveredId;

    this.render(this.currentState);
  };

  private handlePointerLeave = (): void => {
    if (this.hoveredCellId === null) {
      return;
    }

    this.hoveredCellId = null;

    if (!this.draftSourceCellId) {
      this.render(this.currentState);
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.pointerDownCellId && !this.draftSourceCellId) {
      return;
    }

    const state = this.currentState;

    if (state.phase !== "build") {
      this.clearDraft();
      this.render(state);
      return;
    }

    const point = getSvgPoint(this.svg, event.clientX, event.clientY);
    const targetCell = getCellAtPoint(state.board, this.geometryByCellId, point);
    const fallbackCell = state.board.find((cell) => cell.id === this.pointerDownCellId) ?? null;

    if (this.draftSourceCellId) {
      if (this.draftMoved) {
        const evaluation = this.evaluateDraftTarget(state, targetCell);

        if (evaluation.valid && evaluation.target) {
          this.store.connectStructureCells(this.draftSourceCellId, evaluation.target.id);
        } else {
          this.store.cancelConnectionDraft(evaluation.reason);
        }
      } else if (fallbackCell) {
        this.store.handleTileClick(fallbackCell.row, fallbackCell.col);
      }
    } else if (targetCell) {
      this.store.handleTileClick(targetCell.row, targetCell.col);
    }

    this.clearDraft();
    this.hoveredCellId = targetCell?.id ?? null;
    this.render(this.currentState);
  };

  private render(state: GameState): void {
    this.geometryByCellId = buildCellGeometryMap(state.board);
    this.svg.replaceChildren();
    this.drawBackdrop(state);
    this.drawGuideRings(state);
    this.drawConnections(state);

    if (state.boardViewMode === "pattern") {
      this.drawPatternOverlays(state);
    }

    this.drawCells(state);
    this.drawDraftLine(state);
  }

  private drawBackdrop(state: GameState): void {
    if (state.boardViewMode === "pattern") {
      this.svg.appendChild(
        createSvgEl("rect", {
          x: 0,
          y: 0,
          width: VIEW_SIZE,
          height: VIEW_SIZE,
          fill: "#ffffff"
        })
      );
      return;
    }

    const defs = createSvgEl("defs");
    const buildGradient = createSvgEl("radialGradient", {
      id: "settlement-build-bg",
      cx: "50%",
      cy: "46%",
      r: "70%"
    });
    buildGradient.appendChild(
      createSvgEl("stop", { offset: "0%", "stop-color": "#2a1a0f" })
    );
    buildGradient.appendChild(
      createSvgEl("stop", { offset: "64%", "stop-color": "#120d09" })
    );
    buildGradient.appendChild(
      createSvgEl("stop", { offset: "100%", "stop-color": "#080604" })
    );
    defs.appendChild(buildGradient);
    this.svg.appendChild(defs);

    this.svg.appendChild(
      createSvgEl("rect", {
        x: 0,
        y: 0,
        width: VIEW_SIZE,
        height: VIEW_SIZE,
        fill: "url(#settlement-build-bg)"
      })
    );
    this.svg.appendChild(
      createSvgEl("circle", {
        cx: CENTER.x,
        cy: CENTER.y,
        r: RADIAL_SCALE * 1.25,
        fill: "none",
        stroke: "#7b5737",
        "stroke-width": 1.6,
        "stroke-opacity": 0.18
      })
    );
    this.svg.appendChild(
      createSvgEl("circle", {
        cx: CENTER.x,
        cy: CENTER.y,
        r: RADIAL_SCALE * 2.1,
        fill: "none",
        stroke: "#523622",
        "stroke-width": 1.4,
        "stroke-opacity": 0.12
      })
    );
  }

  private drawGuideRings(state: GameState): void {
    const ringLayer = createSvgEl("g");
    const ringStroke = state.boardViewMode === "pattern" ? "#dddddd" : "#9d8a74";
    const spokeStroke = state.boardViewMode === "pattern" ? "#ececec" : "#655545";

    for (let ring = 1; ring <= 3; ring += 1) {
      ringLayer.appendChild(
        createSvgEl("circle", {
          cx: CENTER.x,
          cy: CENTER.y,
          r: RADIAL_SCALE * ring,
          fill: "none",
          stroke: ringStroke,
          "stroke-width": ring === 3 ? 2.6 : 1.95,
          "stroke-opacity": state.boardViewMode === "pattern" ? 0.64 : 0.42
        })
      );
    }

    for (let sector = 0; sector < 24; sector += 1) {
      const angle = (sector / 24) * Math.PI * 2 - Math.PI / 2;
      const inner = {
        x: CENTER.x + Math.cos(angle) * RADIAL_SCALE * 0.76,
        y: CENTER.y + Math.sin(angle) * RADIAL_SCALE * 0.76
      };
      const outer = {
        x: CENTER.x + Math.cos(angle) * RADIAL_SCALE * 3.16,
        y: CENTER.y + Math.sin(angle) * RADIAL_SCALE * 3.16
      };

      ringLayer.appendChild(
        createSvgEl("line", {
          x1: inner.x,
          y1: inner.y,
          x2: outer.x,
          y2: outer.y,
          stroke: spokeStroke,
          "stroke-width": 1.05,
          "stroke-opacity": state.boardViewMode === "pattern" ? 0.34 : 0.16
        })
      );
    }

    this.svg.appendChild(ringLayer);
  }

  private drawConnections(state: GameState): void {
    const byId = new Map(state.board.map((cell) => [cell.id, cell]));
    const seen = new Set<string>();
    const layer = createSvgEl("g");
    const techHighlightCellSet = new Set(
      state.patterns.byIdeology.tech?.contributingCellIds ?? []
    );
    const magicHighlightCellSet = new Set(
      state.patterns.byIdeology.magic?.contributingCellIds ?? []
    );

    for (const cell of state.board) {
      if (!cell.structureId || cell.terrain === "core") {
        continue;
      }

      const from = this.geometryByCellId.get(cell.id);

      if (!from) {
        continue;
      }

      for (const connection of cell.connections) {
        const target = byId.get(connection.toCellId);

        if (!target || !target.structureId || target.terrain === "core") {
          continue;
        }

        const to = this.geometryByCellId.get(target.id);

        if (!to) {
          continue;
        }

        const key = [cell.id, target.id].sort().join(":");

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        const ideologyClass = getConnectionIdeologyClass(cell, target);
        const inTechPattern =
          techHighlightCellSet.has(cell.id) && techHighlightCellSet.has(target.id);
        const inMagicPattern =
          magicHighlightCellSet.has(cell.id) && magicHighlightCellSet.has(target.id);
        const inPatternFocus = inTechPattern || inMagicPattern;

        if (
          state.boardViewMode === "pattern" &&
          ideologyClass === null &&
          !inPatternFocus
        ) {
          continue;
        }

        const stroke =
          ideologyClass === "tech"
            ? "#3f7fcb"
            : ideologyClass === "magic"
              ? "#bf3d3d"
                : ideologyClass === "hybrid"
                  ? "#7f58b5"
                  : "#8f846f";
        const opacity = ideologyClass
          ? state.boardViewMode === "pattern"
            ? inPatternFocus
              ? 0.86
              : 0.32
            : 0.82
          : state.boardViewMode === "pattern"
            ? 0.14
            : 0.44;
        const width = ideologyClass ? (inPatternFocus ? 3.1 : 2.6) : 1.9;

        if (ideologyClass === "tech") {
          const path = getTechPath(from.point, to.point, cell, target);
          layer.appendChild(
            createSvgEl("path", {
              d: path,
              fill: "none",
              stroke,
              "stroke-width": width,
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-opacity": opacity
            })
          );
        } else if (ideologyClass === "magic") {
          const path = getMagicPath(from.point, to.point, cell, target);
          layer.appendChild(
            createSvgEl("path", {
              d: path,
              fill: "none",
              stroke,
              "stroke-width": width,
              "stroke-linecap": "round",
              "stroke-opacity": opacity
            })
          );
        } else if (ideologyClass === "hybrid") {
          layer.appendChild(
            createSvgEl("line", {
              x1: from.point.x,
              y1: from.point.y,
              x2: to.point.x,
              y2: to.point.y,
              stroke,
              "stroke-width": width + 0.3,
              "stroke-linecap": "round",
              "stroke-opacity": opacity
            })
          );
          layer.appendChild(
            createSvgEl("line", {
              x1: from.point.x,
              y1: from.point.y,
              x2: to.point.x,
              y2: to.point.y,
              stroke: "#4f86d5",
              "stroke-width": 1.4,
              "stroke-linecap": "round",
              "stroke-opacity": 0.72
            })
          );
          layer.appendChild(
            createSvgEl("line", {
              x1: from.point.x,
              y1: from.point.y,
              x2: to.point.x,
              y2: to.point.y,
              stroke: "#c84f4f",
              "stroke-width": 0.9,
              "stroke-dasharray": "6 5",
              "stroke-linecap": "round",
              "stroke-opacity": 0.75
            })
          );
        } else {
          layer.appendChild(
            createSvgEl("line", {
              x1: from.point.x,
              y1: from.point.y,
              x2: to.point.x,
              y2: to.point.y,
              stroke,
              "stroke-width": width,
              "stroke-linecap": "round",
              "stroke-opacity": opacity
            })
          );
        }
      }
    }

    this.svg.appendChild(layer);
  }

  private drawPatternOverlays(state: GameState): void {
    const scrapLayer = createSvgEl("g");
    const techLayer = createSvgEl("g");
    const magicLayer = createSvgEl("g");
    const byId = new Map(state.board.map((cell) => [cell.id, cell]));
    const techPatternCellSet = new Set(
      state.patterns.byIdeology.tech?.contributingCellIds ?? []
    );
    const magicPatternCellSet = new Set(
      state.patterns.byIdeology.magic?.contributingCellIds ?? []
    );

    const scrapCells = state.patterns.byIdeology.scrap?.contributingCellIds ?? [];
    for (const cellId of scrapCells) {
      const geometry = this.geometryByCellId.get(cellId);
      if (!geometry) {
        continue;
      }

      scrapLayer.appendChild(
        createSvgEl("circle", {
          cx: geometry.point.x,
          cy: geometry.point.y,
          r: geometry.radius * 1.15,
          fill: "#d9b238",
          "fill-opacity": 0.22,
          stroke: "#d9b238",
          "stroke-width": 1.4,
          "stroke-opacity": 0.42
        })
      );
    }

    const edgeKeys = new Set<string>();
    for (const cell of state.board) {
      if (!cell.structureId || cell.terrain === "core") {
        continue;
      }

      const from = this.geometryByCellId.get(cell.id);
      if (!from) {
        continue;
      }

      for (const connection of cell.connections) {
        const target = byId.get(connection.toCellId);
        const to = target ? this.geometryByCellId.get(target.id) : null;

        if (!target || !to || !target.structureId || target.terrain === "core") {
          continue;
        }

        const key = [cell.id, target.id].sort().join(":");
        if (edgeKeys.has(key)) {
          continue;
        }

        edgeKeys.add(key);
        const sharedTraits = getSharedConnectionTraits(cell, target);
        const inTechPattern =
          techPatternCellSet.has(cell.id) && techPatternCellSet.has(target.id);
        const inMagicPattern =
          magicPatternCellSet.has(cell.id) && magicPatternCellSet.has(target.id);

        if (sharedTraits.includes("tech") && inTechPattern) {
          const techPath = getTechPath(from.point, to.point, cell, target);
          techLayer.appendChild(
            createSvgEl("path", {
              d: techPath,
              fill: "none",
              stroke: "#3f7fcb",
              "stroke-width": 3.3,
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-opacity": 0.82
            })
          );
        }

        if (sharedTraits.includes("magic") && inMagicPattern) {
          const magicPath = getMagicPath(from.point, to.point, cell, target);
          magicLayer.appendChild(
            createSvgEl("path", {
              d: magicPath,
              fill: "none",
              stroke: "#bf3d3d",
              "stroke-width": 3,
              "stroke-linecap": "round",
              "stroke-opacity": 0.82
            })
          );
        }
      }
    }

    this.svg.appendChild(scrapLayer);
    this.svg.appendChild(techLayer);
    this.svg.appendChild(magicLayer);
  }

  private drawCells(state: GameState): void {
    const selectedBuildStructureId = getSelectedBuildStructureId(state);

    for (const cell of state.board) {
      const geometry = this.geometryByCellId.get(cell.id);
      if (!geometry) {
        continue;
      }

      const group = createSvgEl("g");
      const isSelected =
        state.selectedTile?.row === cell.row && state.selectedTile?.col === cell.col;
      const isHovered = this.hoveredCellId === cell.id;
      const draftTargetId = (() => {
        if (!this.draftSourceCellId || !this.draftPointer || !this.draftMoved) {
          return null;
        }

        return getCellAtPoint(state.board, this.geometryByCellId, this.draftPointer)?.id ?? null;
      })();
      const isDraftTarget = draftTargetId === cell.id;
      const isCore = cell.terrain === "core";
      const isStructure = Boolean(cell.structureId);
      const fill =
        state.boardViewMode === "pattern"
          ? isCore
            ? "#ffffff"
            : isStructure
              ? cell.condition <= 1
                ? "#f5ebe5"
                : cell.condition === 2
                  ? "#faf4ec"
                  : "#ffffff"
              : cell.damage === "ruined"
                ? "#f3ece5"
                : "#ffffff"
          : isCore
            ? "#f7f1e7"
            : isStructure
              ? cell.condition <= 1
                ? "#d78772"
                : cell.condition === 2
                  ? "#d7b56b"
                  : "#e5efde"
              : cell.damage === "ruined"
                ? "#87786d"
                : "#f6f1e7";
      const stroke =
        state.boardViewMode === "pattern"
          ? isCore
            ? "#111111"
            : isStructure
              ? cell.condition <= 1
                ? "#bd8d7c"
                : cell.condition === 2
                  ? "#cdbba8"
                  : "#d5d5d5"
              : cell.damage === "ruined"
                ? "#beae9e"
                : "#e3e3e3"
          : isCore
            ? "#181411"
            : isStructure
              ? cell.condition <= 1
                ? "#7f2d22"
                : cell.condition === 2
                  ? "#8b703f"
                  : "#3d6a45"
              : cell.damage === "ruined"
                ? "#595148"
                : "#4a4036";

      const base = createSvgEl("circle", {
        cx: geometry.point.x,
        cy: geometry.point.y,
        r: geometry.radius,
        fill,
        stroke,
        "stroke-width": state.boardViewMode === "pattern" ? 1.6 : 2,
        class: "svg-board-site"
      });

      base.addEventListener("pointerdown", (event) => {
        if (state.phase !== "build") {
          return;
        }

        event.preventDefault();
        const point = getSvgPoint(this.svg, event.clientX, event.clientY);
        this.pointerDownCellId = cell.id;

        if (canStartConnection(state, cell)) {
          this.draftSourceCellId = cell.id;
          this.draftStartPoint = point;
          this.draftPointer = point;
          this.draftMoved = false;
          this.render(this.currentState);
        } else {
          this.draftSourceCellId = null;
          this.draftStartPoint = null;
          this.draftPointer = null;
          this.draftMoved = false;
        }
      });

      group.appendChild(base);

      if (isHovered && !isSelected) {
        group.appendChild(
          createSvgEl("circle", {
            cx: geometry.point.x,
            cy: geometry.point.y,
            r: geometry.radius + 4.5,
            fill: "none",
            stroke: isDraftTarget
              ? (() => {
                  const evaluation = this.evaluateDraftTarget(state, cell);
                  return evaluation.valid ? "#5ea4eb" : "#d16a58";
                })()
              : state.boardViewMode === "pattern"
                ? "#545454"
                : "#f3c27a",
            "stroke-width": 1.8,
            "stroke-opacity": state.boardViewMode === "pattern" ? 0.62 : 0.72,
            "pointer-events": "none"
          })
        );
      }

      if (isSelected) {
        group.appendChild(
          createSvgEl("circle", {
            cx: geometry.point.x,
            cy: geometry.point.y,
            r: geometry.radius + 7,
            fill: "none",
            stroke: "#111111",
            "stroke-width": 3.6,
            "pointer-events": "none"
          })
        );
      }

      if (isStructure && !isCore) {
        const badgeX = geometry.point.x + geometry.radius * 0.68;
        const badgeY = geometry.point.y - geometry.radius * 0.68;
        const badgeFill = state.boardViewMode === "pattern" ? "#141414" : "#1f1812";
        const badgeStroke = state.boardViewMode === "pattern" ? "#545454" : "#a67d47";
        const badgeText = document.createElementNS(SVG_NS, "text");
        badgeText.setAttribute("x", `${badgeX}`);
        badgeText.setAttribute("y", `${badgeY + 3}`);
        badgeText.setAttribute("text-anchor", "middle");
        badgeText.setAttribute("font-family", "Trebuchet MS, Verdana, sans-serif");
        badgeText.setAttribute("font-size", "9");
        badgeText.setAttribute("font-weight", "700");
        badgeText.setAttribute("fill", "#f4ead7");
        badgeText.setAttribute("pointer-events", "none");
        badgeText.textContent = `${cell.connections.length}`;

        group.appendChild(
          createSvgEl("circle", {
            cx: badgeX,
            cy: badgeY,
            r: 7.1,
            fill: badgeFill,
            stroke: badgeStroke,
            "stroke-width": 1.4,
            "pointer-events": "none"
          })
        );
        group.appendChild(badgeText);
      }

      if (state.boardViewMode === "build") {
        if (cell.structureId) {
          const structureLabel = STRUCTURE_SHORT_LABEL[cell.structureId] ?? cell.structureId.slice(0, 2).toUpperCase();
          const title = document.createElementNS(SVG_NS, "text");
          title.setAttribute("x", `${geometry.point.x}`);
          title.setAttribute("y", `${geometry.point.y + 1}`);
          title.setAttribute("text-anchor", "middle");
          title.setAttribute("font-family", "Trebuchet MS, Verdana, sans-serif");
          title.setAttribute("font-size", `${Math.max(10, Math.floor(geometry.radius * 0.44))}`);
          title.setAttribute("font-weight", "700");
          title.setAttribute("fill", "#120f0d");
          title.setAttribute("pointer-events", "none");
          title.textContent = structureLabel;
          group.appendChild(title);

          const meta = document.createElementNS(SVG_NS, "text");
          meta.setAttribute("x", `${geometry.point.x}`);
          meta.setAttribute("y", `${geometry.point.y + geometry.radius * 0.72}`);
          meta.setAttribute("text-anchor", "middle");
          meta.setAttribute("font-family", "Trebuchet MS, Verdana, sans-serif");
          meta.setAttribute("font-size", `${Math.max(8, Math.floor(geometry.radius * 0.24))}`);
          meta.setAttribute("fill", "#3e372f");
          meta.setAttribute("pointer-events", "none");
          const links = cell.connections.length;
          const ideology = cell.appliedIdeologies.length > 0
            ? cell.appliedIdeologies.map((entry) => entry.toUpperCase()).join("+")
            : "N";
          meta.textContent = `${ideology} · S${cell.stackLevel} · L${links}`;
          group.appendChild(meta);
        } else if (cell.terrain === "core") {
          const coreText = document.createElementNS(SVG_NS, "text");
          coreText.setAttribute("x", `${geometry.point.x}`);
          coreText.setAttribute("y", `${geometry.point.y + 4}`);
          coreText.setAttribute("text-anchor", "middle");
          coreText.setAttribute("font-family", "Trebuchet MS, Verdana, sans-serif");
          coreText.setAttribute("font-size", "12");
          coreText.setAttribute("font-weight", "700");
          coreText.setAttribute("fill", "#171411");
          coreText.setAttribute("pointer-events", "none");
          coreText.textContent = "CORE";
          group.appendChild(coreText);
        } else if (selectedBuildStructureId && !cell.structureId) {
          const hint = document.createElementNS(SVG_NS, "text");
          hint.setAttribute("x", `${geometry.point.x}`);
          hint.setAttribute("y", `${geometry.point.y + 4}`);
          hint.setAttribute("text-anchor", "middle");
          hint.setAttribute("font-family", "Trebuchet MS, Verdana, sans-serif");
          hint.setAttribute("font-size", "10");
          hint.setAttribute("fill", "#766c61");
          hint.setAttribute("pointer-events", "none");
          hint.textContent = "+";
          group.appendChild(hint);
        }
      } else if (cell.structureId && cell.terrain !== "core") {
        const pips = createSvgEl("g", {
          "pointer-events": "none"
        });
        const scrapCount = Math.max(1, cell.stackLevel);
        const techCount = hasIdeologyTrait(cell, "tech") ? 2 : 0;
        const magicCount = hasIdeologyTrait(cell, "magic") ? 2 : 0;
        const palette = [
          ...Array.from({ length: scrapCount }, () => "#d9b238"),
          ...Array.from({ length: techCount }, () => "#3f7fcb"),
          ...Array.from({ length: magicCount }, () => "#bf3d3d")
        ];
        const startX = geometry.point.x - ((palette.length - 1) * 4.5) / 2;

        palette.forEach((color, index) => {
          pips.appendChild(
            createSvgEl("circle", {
              cx: startX + index * 4.5,
              cy: geometry.point.y,
              r: 2.6,
              fill: color
            })
          );
        });
        group.appendChild(pips);
      }

      this.svg.appendChild(group);
    }
  }

  private drawDraftLine(state: GameState): void {
    if (!this.draftSourceCellId || !this.draftPointer) {
      return;
    }

    const source = state.board.find((cell) => cell.id === this.draftSourceCellId);
    const sourceGeometry = source ? this.geometryByCellId.get(source.id) : null;

    if (!source || !sourceGeometry) {
      return;
    }

    const targetCell = getCellAtPoint(state.board, this.geometryByCellId, this.draftPointer);
    const evaluation = this.evaluateDraftTarget(state, targetCell);
    const targetValid = evaluation.valid;
    const stroke = targetCell ? (targetValid ? "#63a0e6" : "#d16a58") : "#8b8378";
    const targetGeometry =
      evaluation.valid && evaluation.target
        ? this.geometryByCellId.get(evaluation.target.id)
        : targetCell
          ? this.geometryByCellId.get(targetCell.id)
          : null;
    const endpoint = targetGeometry ? targetGeometry.point : this.draftPointer;

    this.svg.appendChild(
      createSvgEl("line", {
        x1: sourceGeometry.point.x,
        y1: sourceGeometry.point.y,
        x2: endpoint.x,
        y2: endpoint.y,
        stroke,
        "stroke-width": 2.4,
        "stroke-opacity": 0.75,
        "stroke-dasharray": "6 5",
        "stroke-linecap": "round",
        "pointer-events": "none"
      })
    );
  }
}

export function createSettlementBoardSurface(parent: HTMLElement, store: GameStore): { destroy: () => void } {
  const surface = new SettlementBoardSurface(parent, store);

  return {
    destroy: () => surface.destroy()
  };
}
