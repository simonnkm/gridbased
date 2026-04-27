import Phaser from "phaser";

import { getStructureCardDefinition } from "../../data/structures";
import { getMaintenanceCellState, type MaintenanceTier } from "../../game/maintenance";
import {
  buildPatternVisualization,
  getIdeologyColor,
  type PatternVisualization,
  type VisualizationBlob,
  type VisualizationPoint,
  type VisualizationStroke
} from "../../game/patterns/buildPatternVisualization";
import {
  type Ideology,
  type PlacementRecommendation,
  type PlacementRecommendationTier
} from "../../game/patterns/types";
import { getPlacementPreview } from "../../game/preview/getPlacementPreview";
import { getEmptyTileCount, getSelectedBuildStructureId } from "../../game/selectors";
import { GameStore } from "../../game/state/gameStore";
import type { GameState } from "../../game/state/types";
import { formatSiteLabel, getRadialSitePoint } from "../../game/board/radialTopology";

interface CellView {
  baseDisk: Phaser.GameObjects.Ellipse;
  coreHalo: Phaser.GameObjects.Ellipse;
  selectionRing: Phaser.GameObjects.Ellipse;
  hoverRing: Phaser.GameObjects.Ellipse;
  recommendationRing: Phaser.GameObjects.Ellipse;
  scrapAccentDot: Phaser.GameObjects.Ellipse;
  techAccentDot: Phaser.GameObjects.Ellipse;
  magicAccentDot: Phaser.GameObjects.Ellipse;
  labelText: Phaser.GameObjects.Text;
  detailText: Phaser.GameObjects.Text;
  conditionText: Phaser.GameObjects.Text;
  center: Phaser.Math.Vector2;
  radius: number;
}

const HIGHLIGHT_COLORS: Record<Ideology, number> = {
  scrap: 0xd9b238,
  tech: 0x3f7fcb,
  magic: 0xbf3d3d
};

const RECOMMENDATION_STROKES: Record<
  PlacementRecommendationTier,
  { color: number; width: number; alpha: number }
> = {
  best: { color: 0x171411, width: 3, alpha: 0.92 },
  good: { color: 0x6d6861, width: 2.2, alpha: 0.72 },
  possible: { color: 0xb8b4ae, width: 1.8, alpha: 0.88 }
};

const RECOMMENDATION_TIER_SCORE: Record<PlacementRecommendationTier, number> = {
  best: 3,
  good: 2,
  possible: 1
};

const MAINTENANCE_LABELS: Record<MaintenanceTier, string> = {
  core: "Core anchor",
  stable: "Inner support",
  stretched: "Frontier stretch",
  remote: "Exposed frontier"
};

export class SettlementScene extends Phaser.Scene {
  private center = new Phaser.Math.Vector2(480, 500);
  private radialScale = 116;
  private readonly cellViews = new Map<string, CellView>();
  private unsubscribe?: () => void;
  private footerText?: Phaser.GameObjects.Text;
  private titleText?: Phaser.GameObjects.Text;
  private subtitleText?: Phaser.GameObjects.Text;
  private backdropPanel?: Phaser.GameObjects.Rectangle;
  private ringGuideGraphics?: Phaser.GameObjects.Graphics;
  private connectionLinkGraphics?: Phaser.GameObjects.Graphics;
  private patternGhostGraphics?: Phaser.GameObjects.Graphics;
  private patternFillGraphics?: Phaser.GameObjects.Graphics;
  private patternLineGraphics?: Phaser.GameObjects.Graphics;
  private patternNodeGraphics?: Phaser.GameObjects.Graphics;
  private patternPipGraphics?: Phaser.GameObjects.Graphics;
  private previewGhostGraphics?: Phaser.GameObjects.Graphics;
  private modeTransitionCurtain?: Phaser.GameObjects.Rectangle;
  private hoverTooltipPanel?: Phaser.GameObjects.Rectangle;
  private hoverTooltipText?: Phaser.GameObjects.Text;
  private hoveredCellId: string | null = null;
  private connectionDraftSourceCellId: string | null = null;
  private connectionDraftStartPointer: Phaser.Math.Vector2 | null = null;
  private connectionDraftPointer: Phaser.Math.Vector2 | null = null;
  private connectionDraftMoved = false;
  private lastBoardViewMode: GameState["boardViewMode"] | null = null;

  constructor(private readonly store: GameStore) {
    super("settlement-scene");
  }

  create(): void {
    const state = this.store.getState();

    this.drawBackdrop();
    this.drawPatternLayers();
    this.drawBoard(state);
    this.renderState(state);
    this.unsubscribe = this.store.subscribe((nextState) => this.renderState(nextState));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.connectionDraftSourceCellId) {
        return;
      }

      const nextPointer = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      this.connectionDraftPointer = nextPointer;

      if (!this.connectionDraftMoved && this.connectionDraftStartPointer) {
        const distance = Phaser.Math.Distance.Between(
          this.connectionDraftStartPointer.x,
          this.connectionDraftStartPointer.y,
          nextPointer.x,
          nextPointer.y
        );

        if (distance >= 8) {
          this.connectionDraftMoved = true;
        }
      }

      this.renderState(this.store.getState());
    });
    this.input.on("pointerup", () => {
      if (!this.connectionDraftSourceCellId) {
        return;
      }

      if (this.connectionDraftMoved) {
        this.store.cancelConnectionDraft(
          "Connection cancelled. Release on another built structure to create a link."
        );
      }

      this.connectionDraftSourceCellId = null;
      this.connectionDraftStartPointer = null;
      this.connectionDraftPointer = null;
      this.connectionDraftMoved = false;
      this.renderState(this.store.getState());
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
    });
  }

  private getSiteRadius(cell: GameState["board"][number]): number {
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

  private getCellPoint(cell: Pick<GameState["board"][number], "ring" | "sector">): Phaser.Math.Vector2 {
    const radialPoint = getRadialSitePoint(cell);

    return new Phaser.Math.Vector2(
      this.center.x + radialPoint.x * this.radialScale,
      this.center.y + radialPoint.y * this.radialScale
    );
  }

  private drawBackdrop(): void {
    this.backdropPanel = this.add
      .rectangle(480, 500, 840, 812, 0xf4f0e8, 1)
      .setStrokeStyle(3, 0x171411, 1);

    this.titleText = this.add.text(136, 58, "Radial Settlement", {
      fontFamily: "Palatino Linotype, Book Antiqua, serif",
      fontSize: "34px",
      color: "#171411"
    });

    this.subtitleText = this.add.text(
      136,
      102,
      "Build outward from the Core through concentric sectors. Keep support density high as you expand.",
      {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "16px",
        color: "#464038",
        wordWrap: { width: 654 }
      }
    );

    this.footerText = this.add.text(136, 904, "Build View active.", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "16px",
      color: "#2e2823"
    });

    this.modeTransitionCurtain = this.add
      .rectangle(480, 500, 840, 812, 0xffffff, 0)
      .setDepth(42);

    this.hoverTooltipPanel = this.add
      .rectangle(140, 140, 224, 62, 0x111111, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1.5, 0xffffff, 0.12)
      .setDepth(40)
      .setVisible(false);

    this.hoverTooltipText = this.add
      .text(152, 150, "", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "12px",
        color: "#f5f0e7",
        lineSpacing: 3,
        wordWrap: { width: 198 }
      })
      .setDepth(41)
      .setVisible(false);
  }

  private drawPatternLayers(): void {
    this.ringGuideGraphics = this.add.graphics().setDepth(2);
    this.connectionLinkGraphics = this.add.graphics().setDepth(8);
    this.patternGhostGraphics = this.add.graphics().setDepth(6);
    this.patternFillGraphics = this.add.graphics().setDepth(7);
    this.patternLineGraphics = this.add.graphics().setDepth(9);
    this.patternNodeGraphics = this.add.graphics().setDepth(12);
    this.patternPipGraphics = this.add.graphics().setDepth(13);
    this.previewGhostGraphics = this.add.graphics().setDepth(16);
  }

  private drawConnectionLinks(state: GameState): void {
    const graphics = this.connectionLinkGraphics;

    if (!graphics) {
      return;
    }

    graphics.clear();
    if (state.boardViewMode === "build") {
      const edgeKeys = new Set<string>();

      for (const cell of state.board) {
        if (!cell.structureId || cell.terrain === "core") {
          continue;
        }

        const fromPoint = this.getCellPoint(cell);

        for (const connection of cell.connections) {
          const target = state.board.find((candidate) => candidate.id === connection.toCellId);

          if (!target || !target.structureId || target.terrain === "core") {
            continue;
          }

          const edgeKey = [cell.id, target.id].sort().join(":");

          if (edgeKeys.has(edgeKey)) {
            continue;
          }

          edgeKeys.add(edgeKey);
          const renderedIdeology =
            cell.appliedIdeology &&
            cell.appliedIdeology === target.appliedIdeology
              ? cell.appliedIdeology
              : null;
          const color = renderedIdeology
            ? HIGHLIGHT_COLORS[renderedIdeology]
            : 0x7f7a73;
          const alpha = renderedIdeology ? 0.48 : 0.34;
          const width = renderedIdeology ? 2.5 : 2;
          const targetPoint = this.getCellPoint(target);

          if (renderedIdeology === "tech") {
            graphics.lineStyle(width, color, alpha);
            graphics.beginPath();
            graphics.moveTo(fromPoint.x, fromPoint.y);
            graphics.lineTo(targetPoint.x, fromPoint.y);
            graphics.lineTo(targetPoint.x, targetPoint.y);
            graphics.strokePath();
          } else if (renderedIdeology === "magic") {
            const midpoint = {
              x: (fromPoint.x + targetPoint.x) / 2,
              y: (fromPoint.y + targetPoint.y) / 2
            };
            const deltaX = targetPoint.x - fromPoint.x;
            const deltaY = targetPoint.y - fromPoint.y;
            const distance = Math.max(0.001, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
            const normal = {
              x: -deltaY / distance,
              y: deltaX / distance
            };
            const bend = 14 + Math.min(16, distance * 0.1);
            const curve = new Phaser.Curves.Spline([
              new Phaser.Math.Vector2(fromPoint.x, fromPoint.y),
              new Phaser.Math.Vector2(
                midpoint.x + normal.x * bend,
                midpoint.y + normal.y * bend
              ),
              new Phaser.Math.Vector2(targetPoint.x, targetPoint.y)
            ]);
            const sampled = curve.getPoints(18);

            graphics.lineStyle(width, color, alpha);
            graphics.strokePoints(sampled, false, true);
          } else {
            graphics.lineStyle(width, color, alpha);
            graphics.lineBetween(fromPoint.x, fromPoint.y, targetPoint.x, targetPoint.y);
          }
        }
      }
    }

    if (!this.connectionDraftSourceCellId || !this.connectionDraftPointer) {
      return;
    }

    const sourceCell = state.board.find((cell) => cell.id === this.connectionDraftSourceCellId);

    if (!sourceCell || !sourceCell.structureId || sourceCell.terrain === "core") {
      return;
    }

    const sourcePoint = this.getCellPoint(sourceCell);
    graphics.lineStyle(2.4, 0x7f7a73, 0.45);
    graphics.lineBetween(
      sourcePoint.x,
      sourcePoint.y,
      this.connectionDraftPointer.x,
      this.connectionDraftPointer.y
    );
  }

  private drawBoard(state: GameState): void {
    for (const cell of state.board) {
      const center = this.getCellPoint(cell);
      const radius = this.getSiteRadius(cell);
      const baseDisk = this.add
        .ellipse(center.x, center.y, radius * 2, radius * 2, 0xf8f5ef, 1)
        .setStrokeStyle(2, 0x1b1714, 1)
        .setInteractive(
          new Phaser.Geom.Circle(radius, radius, radius),
          Phaser.Geom.Circle.Contains
        );

      baseDisk.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const stateSnapshot = this.store.getState();

        if (stateSnapshot.phase !== "build") {
          return;
        }

        if (
          !stateSnapshot.selectedCardInstanceId &&
          !stateSnapshot.selectedNodeStructureId &&
          !stateSnapshot.selectedIdeologyCard &&
          cell.structureId &&
          cell.terrain !== "core"
        ) {
          this.connectionDraftSourceCellId = cell.id;
          this.connectionDraftStartPointer = new Phaser.Math.Vector2(
            pointer.worldX,
            pointer.worldY
          );
          this.connectionDraftPointer = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
          this.connectionDraftMoved = false;
          this.renderState(stateSnapshot);
        }
      });

      baseDisk.on("pointerup", () => {
        const stateSnapshot = this.store.getState();

        if (stateSnapshot.phase !== "build") {
          return;
        }

        if (this.connectionDraftSourceCellId) {
          const sourceCellId = this.connectionDraftSourceCellId;
          const isValidTarget = cell.structureId && cell.terrain !== "core";
          const wasDrag = this.connectionDraftMoved;

          this.connectionDraftSourceCellId = null;
          this.connectionDraftStartPointer = null;
          this.connectionDraftPointer = null;
          this.connectionDraftMoved = false;

          if (!wasDrag) {
            this.store.handleTileClick(cell.row, cell.col);
            return;
          }

          if (sourceCellId !== cell.id && isValidTarget) {
            this.store.connectStructureCells(sourceCellId, cell.id);
          } else {
            this.store.cancelConnectionDraft(
              "Invalid connection target. Release on a different built structure."
            );
          }

          return;
        }

        this.store.handleTileClick(cell.row, cell.col);
      });

      baseDisk.on("pointerover", () => {
        if (this.hoveredCellId === cell.id) {
          return;
        }

        this.hoveredCellId = cell.id;
        this.renderState(this.store.getState());
      });

      baseDisk.on("pointerout", () => {
        if (this.hoveredCellId !== cell.id) {
          return;
        }

        this.hoveredCellId = null;
        this.renderState(this.store.getState());
      });

      const coreHalo = this.add
        .ellipse(center.x, center.y, radius * 2.35, radius * 2.35, 0xf9f6ee, 0.65)
        .setStrokeStyle(3, 0x15110e, 0.9)
        .setVisible(cell.terrain === "core")
        .setDepth(4);

      const selectionRing = this.add
        .ellipse(center.x, center.y, radius * 2.5, radius * 2.5, 0x000000, 0)
        .setStrokeStyle(2, 0x2d261f, 1)
        .setDepth(18);

      const hoverRing = this.add
        .ellipse(center.x, center.y, radius * 2.25, radius * 2.25, 0x000000, 0)
        .setStrokeStyle(0, 0x000000, 0)
        .setDepth(17)
        .setVisible(false);

      const recommendationRing = this.add
        .ellipse(center.x, center.y, radius * 2.85, radius * 2.85, 0x000000, 0)
        .setStrokeStyle(0, 0x000000, 0)
        .setVisible(false)
        .setDepth(15);

      const scrapAccentDot = this.add
        .ellipse(center.x - radius * 0.64, center.y, 7.5, 7.5, HIGHLIGHT_COLORS.scrap, 1)
        .setVisible(false)
        .setDepth(14);

      const techAccentDot = this.add
        .ellipse(center.x, center.y - radius * 0.68, 7.5, 7.5, HIGHLIGHT_COLORS.tech, 1)
        .setVisible(false)
        .setDepth(14);

      const magicAccentDot = this.add
        .ellipse(center.x + radius * 0.64, center.y, 7.5, 7.5, HIGHLIGHT_COLORS.magic, 1)
        .setVisible(false)
        .setDepth(14);

      const labelText = this.add
        .text(center.x, center.y - 4, "", {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: `${Math.max(11, Math.floor(radius * 0.44))}px`,
          color: "#171411",
          fontStyle: "bold"
        })
        .setOrigin(0.5, 0.5)
        .setDepth(19);

      const detailText = this.add
        .text(center.x, center.y + radius * 0.5, "", {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: `${Math.max(9, Math.floor(radius * 0.25))}px`,
          color: "#5f5549",
          align: "center"
        })
        .setOrigin(0.5, 0.5)
        .setDepth(19);

      const conditionText = this.add
        .text(center.x, center.y + radius * 0.79, "", {
          fontFamily: "Trebuchet MS, Verdana, sans-serif",
          fontSize: `${Math.max(8, Math.floor(radius * 0.3))}px`,
          color: "#7f2f1f",
          align: "center"
        })
        .setOrigin(0.5, 0.5)
        .setDepth(19);

      this.cellViews.set(cell.id, {
        baseDisk,
        coreHalo,
        selectionRing,
        hoverRing,
        recommendationRing,
        scrapAccentDot,
        techAccentDot,
        magicAccentDot,
        labelText,
        detailText,
        conditionText,
        center,
        radius
      });
    }
  }

  private getBuildModePalette(
    cell: GameState["board"][number],
    isSelected: boolean
  ): {
    fill: number;
    stroke: number;
    titleColor: string;
    detailColor: string;
    conditionColor: string;
  } {
    if (cell.terrain === "core") {
      return {
        fill: 0xf7f3ec,
        stroke: 0x181411,
        titleColor: "#171411",
        detailColor: "#4f4841",
        conditionColor: "#5f5549"
      };
    }

    if (cell.structureId) {
      if (cell.condition <= 1) {
        return {
          fill: 0xf0c3b8,
          stroke: isSelected ? 0x111111 : 0x9f3e2d,
          titleColor: "#27140f",
          detailColor: "#8f3c30",
          conditionColor: "#ab3123"
        };
      }

      if (cell.condition === 2) {
        return {
          fill: 0xf2e5c6,
          stroke: isSelected ? 0x111111 : 0xa88a54,
          titleColor: "#1f1812",
          detailColor: "#775f3c",
          conditionColor: "#9b7532"
        };
      }

      return {
        fill: 0xe5efde,
        stroke: isSelected ? 0x111111 : 0x487050,
        titleColor: "#17130f",
        detailColor: "#35583d",
        conditionColor: "#3f7a4f"
      };
    }

    if (cell.damage === "ruined") {
      return {
        fill: 0xc9beb2,
        stroke: isSelected ? 0x111111 : 0x6e655d,
        titleColor: "#514840",
        detailColor: "#514840",
        conditionColor: "#514840"
      };
    }

    return {
      fill: isSelected ? 0xebe3d7 : 0xf8f5ef,
      stroke: isSelected ? 0x111111 : 0x52493f,
      titleColor: "#6c6258",
      detailColor: "#7d7468",
      conditionColor: "#7d7468"
    };
  }

  private getPatternModePalette(
    cell: GameState["board"][number],
    isSelected: boolean
  ): {
    fill: number;
    stroke: number;
  } {
    if (cell.terrain === "core") {
      return {
        fill: 0xffffff,
        stroke: 0x111111
      };
    }

    if (cell.structureId) {
      if (cell.condition <= 1) {
        return {
          fill: 0xf8f4f1,
          stroke: isSelected ? 0x111111 : 0xc39f90
        };
      }

      if (cell.condition === 2) {
        return {
          fill: 0xfcf9f5,
          stroke: isSelected ? 0x111111 : 0xd7c9bd
        };
      }

      return {
        fill: 0xffffff,
        stroke: isSelected ? 0x111111 : 0xdedede
      };
    }

    if (cell.damage === "ruined") {
      return {
        fill: 0xf7f3ee,
        stroke: isSelected ? 0x111111 : 0xc8b9ae
      };
    }

    return {
      fill: 0xffffff,
      stroke: isSelected ? 0x111111 : 0xe3e3e3
    };
  }

  private toPixelPoint(point: VisualizationPoint): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      this.center.x + point.x * this.radialScale,
      this.center.y + point.y * this.radialScale
    );
  }

  private animateBoardViewTransition(boardViewMode: GameState["boardViewMode"]): void {
    if (!this.modeTransitionCurtain) {
      return;
    }

    this.tweens.killTweensOf(this.modeTransitionCurtain);
    this.modeTransitionCurtain
      .setFillStyle(boardViewMode === "pattern" ? 0xffffff : 0xf5ede0, 0.18)
      .setAlpha(0.18);
    this.tweens.add({
      targets: this.modeTransitionCurtain,
      alpha: 0,
      duration: 160,
      ease: "Sine.Out"
    });
  }

  private drawRingGuides(state: GameState): void {
    const graphics = this.ringGuideGraphics;

    if (!graphics) {
      return;
    }

    graphics.clear();
    const strokeColor = state.boardViewMode === "pattern" ? 0xdbdbdb : 0xa99884;
    const spokeColor = state.boardViewMode === "pattern" ? 0xe9e9e9 : 0xc5b39d;
    const outerRadius = this.radialScale * 3.16;

    for (let ring = 1; ring <= 3; ring += 1) {
      graphics.lineStyle(
        ring === 3 ? 2.2 : 1.7,
        strokeColor,
        state.boardViewMode === "pattern" ? 0.62 : 0.48
      );
      graphics.strokeCircle(this.center.x, this.center.y, this.radialScale * ring);
    }

    graphics.lineStyle(1, spokeColor, state.boardViewMode === "pattern" ? 0.32 : 0.22);

    for (let sector = 0; sector < 24; sector += 1) {
      const angle = (sector / 24) * Math.PI * 2 - Math.PI / 2;
      const inner = Phaser.Math.Vector2.ZERO.clone().setToPolar(angle, this.radialScale * 0.76);
      const outer = Phaser.Math.Vector2.ZERO.clone().setToPolar(angle, outerRadius);

      graphics.lineBetween(
        this.center.x + inner.x,
        this.center.y + inner.y,
        this.center.x + outer.x,
        this.center.y + outer.y
      );
    }

    graphics.fillStyle(state.boardViewMode === "pattern" ? 0xffffff : 0xf4f0e8, 1);
    graphics.fillCircle(this.center.x, this.center.y, 26);
    graphics.lineStyle(2, state.boardViewMode === "pattern" ? 0xd4d4d4 : 0x8f7f6d, 0.8);
    graphics.strokeCircle(this.center.x, this.center.y, 26);
  }

  private drawPlacementGhost(
    state: GameState,
    preview: ReturnType<typeof getPlacementPreview>
  ): void {
    const graphics = this.previewGhostGraphics;

    if (!graphics) {
      return;
    }

    graphics.clear();

    if (!preview) {
      return;
    }

    const targetCell = state.board.find((cell) => cell.id === preview.cellId);

    if (!targetCell) {
      return;
    }

    const center = this.getCellPoint(targetCell);
    const radius = this.getSiteRadius(targetCell);
    const definition = getStructureCardDefinition(preview.structureId);

    graphics.fillStyle(definition.boardColor, state.boardViewMode === "pattern" ? 0.14 : 0.24);
    graphics.fillCircle(center.x, center.y, radius - 3);
    graphics.lineStyle(2.2, definition.boardColor, 0.72);
    graphics.strokeCircle(center.x, center.y, radius - 3);
  }

  private getConnectionProfile(
    state: GameState,
    cell: GameState["board"][number]
  ): {
    total: number;
    tech: number;
    magic: number;
    neutral: number;
  } {
    let total = 0;
    let tech = 0;
    let magic = 0;
    let neutral = 0;

    for (const connection of cell.connections) {
      const target = state.board.find((candidate) => candidate.id === connection.toCellId);

      if (!target || !target.structureId || target.terrain === "core") {
        continue;
      }

      total += 1;

      if (cell.appliedIdeology === "tech" && target.appliedIdeology === "tech") {
        tech += 1;
      } else if (cell.appliedIdeology === "magic" && target.appliedIdeology === "magic") {
        magic += 1;
      } else {
        neutral += 1;
      }
    }

    return { total, tech, magic, neutral };
  }

  private renderHoverTooltip(
    state: GameState,
    preview: ReturnType<typeof getPlacementPreview>
  ): void {
    if (!this.hoverTooltipPanel || !this.hoverTooltipText) {
      return;
    }

    this.hoverTooltipPanel.setVisible(false);
    this.hoverTooltipText.setVisible(false);

    if (!this.hoveredCellId) {
      return;
    }

    const hoveredCell = state.board.find((cell) => cell.id === this.hoveredCellId);
    const selectedBuildStructureId = getSelectedBuildStructureId(state);
    const hoveredView = hoveredCell ? this.cellViews.get(hoveredCell.id) : null;

    if (!hoveredCell || !hoveredView) {
      return;
    }

    const tooltipX = Phaser.Math.Clamp(hoveredView.center.x + hoveredView.radius + 12, 112, 720);
    const tooltipY = Phaser.Math.Clamp(hoveredView.center.y - hoveredView.radius - 14, 124, 820);
    let text = "";

    if (preview) {
      const definition = getStructureCardDefinition(preview.structureId);

      text = `${definition.title}\n${preview.patternSummary}\n${preview.maintenanceSummary}`;
    } else if (selectedBuildStructureId) {
      if (hoveredCell.terrain === "core") {
        text = "Core\nBuild around it, never on it.";
      } else if (hoveredCell.structureId) {
        text = `${getStructureCardDefinition(hoveredCell.structureId).title}\nOccupied site`;
      } else {
        const maintenanceState = getMaintenanceCellState(state.boardSize, hoveredCell);
        text = `${formatSiteLabel(hoveredCell)}\n${MAINTENANCE_LABELS[maintenanceState.tier]}`;
      }
    } else if (hoveredCell.structureId) {
      const profile = this.getConnectionProfile(state, hoveredCell);
      const ideologyLabel = hoveredCell.appliedIdeology
        ? hoveredCell.appliedIdeology === "tech"
          ? "Tech"
          : "Magic"
        : "Neutral";
      text = `${getStructureCardDefinition(hoveredCell.structureId).title}\n${formatSiteLabel(hoveredCell)} | Stack ${hoveredCell.stackLevel} | Links ${profile.total}/3 | ${ideologyLabel}`;
    } else if (hoveredCell.terrain !== "core") {
      text = `${formatSiteLabel(hoveredCell)}\nOpen site`;
    } else {
      return;
    }

    this.hoverTooltipText.setText(text);
    const bounds = this.hoverTooltipText.getBounds();
    this.hoverTooltipPanel
      .setPosition(tooltipX, tooltipY)
      .setSize(Math.max(186, bounds.width + 24), bounds.height + 18)
      .setVisible(true);
    this.hoverTooltipText.setPosition(tooltipX + 12, tooltipY + 9).setVisible(true);
  }

  private renderPatternPips(state: GameState): void {
    const graphics = this.patternPipGraphics;

    if (!graphics) {
      return;
    }

    graphics.clear();

    if (state.boardViewMode !== "pattern") {
      return;
    }

    for (const cell of state.board) {
      if (!cell.structureId || cell.terrain === "core") {
        continue;
      }

      const pips: Ideology[] = [];
      const scrapPips = Math.max(1, cell.stackLevel);
      const connectionProfile = this.getConnectionProfile(state, cell);
      const techPips =
        cell.appliedIdeology === "tech"
          ? Math.min(3, 1 + connectionProfile.tech)
          : 0;
      const magicPips =
        cell.appliedIdeology === "magic"
          ? Math.min(3, 1 + connectionProfile.magic)
          : 0;

      for (let index = 0; index < scrapPips; index += 1) {
        pips.push("scrap");
      }

      for (let index = 0; index < techPips; index += 1) {
        pips.push("tech");
      }

      for (let index = 0; index < magicPips; index += 1) {
        pips.push("magic");
      }

      const view = this.cellViews.get(cell.id);

      if (!view || pips.length === 0) {
        continue;
      }

      const pipRing = Math.max(5.6, view.radius * 0.42);
      const pipRadius = Math.max(2.3, view.radius * 0.12);
      const startAngle = -Math.PI / 2 - ((pips.length - 1) * 0.36) / 2;

      pips.forEach((ideology, index) => {
        const angle = startAngle + index * 0.36;
        const point = Phaser.Math.Vector2.ZERO.clone().setToPolar(angle, pipRing);

        graphics.fillStyle(getIdeologyColor(ideology), 0.95);
        graphics.fillCircle(view.center.x + point.x, view.center.y + point.y, pipRadius);
      });
    }
  }

  private getActivePatternCells(state: GameState, ideology: Ideology): Set<string> {
    return new Set(state.patterns.byIdeology[ideology]?.contributingCellIds ?? []);
  }

  private getShapeScore(
    cellIds: string[],
    activeCellIds: Set<string>,
    emphasized: boolean,
    reinforcement: number,
    size: number,
    projected: boolean
  ): number {
    const overlapCount = cellIds.reduce(
      (total, cellId) => total + (activeCellIds.has(cellId) ? 1 : 0),
      0
    );

    return (
      overlapCount * 16 +
      (emphasized ? 5 : 0) +
      reinforcement * 2.5 +
      size * 0.4 +
      (projected ? 0.35 : 0)
    );
  }

  private pickBestStroke(
    strokes: VisualizationStroke[],
    activeCellIds: Set<string>,
    projected: boolean
  ): VisualizationStroke | null {
    const candidates = strokes.filter((stroke) => stroke.projected === projected);

    if (candidates.length === 0) {
      return null;
    }

    return [...candidates]
      .sort((left, right) => {
        const leftScore = this.getShapeScore(
          left.cellIds,
          activeCellIds,
          left.emphasized,
          left.reinforcement,
          left.points.length,
          projected
        );
        const rightScore = this.getShapeScore(
          right.cellIds,
          activeCellIds,
          right.emphasized,
          right.reinforcement,
          right.points.length,
          projected
        );

        return rightScore - leftScore;
      })[0] ?? null;
  }

  private pickBestBlob(
    blobs: VisualizationBlob[],
    activeCellIds: Set<string>,
    projected: boolean
  ): VisualizationBlob | null {
    const candidates = blobs.filter((blob) => blob.projected === projected);

    if (candidates.length === 0) {
      return null;
    }

    return [...candidates]
      .sort((left, right) => {
        const leftScore = this.getShapeScore(
          left.cellIds,
          activeCellIds,
          left.emphasized,
          left.reinforcement,
          left.circles.length + left.bridges.length,
          projected
        );
        const rightScore = this.getShapeScore(
          right.cellIds,
          activeCellIds,
          right.emphasized,
          right.reinforcement,
          right.circles.length + right.bridges.length,
          projected
        );

        return rightScore - leftScore;
      })[0] ?? null;
  }

  private getVisibleRecommendationMap(state: GameState): Map<string, PlacementRecommendation> {
    const bestByIdeology = new Map<Ideology, PlacementRecommendation>();

    for (const recommendation of state.patterns.placementRecommendations) {
      for (const ideology of recommendation.ideologies) {
        const current = bestByIdeology.get(ideology);

        if (!current) {
          bestByIdeology.set(ideology, recommendation);
          continue;
        }

        const currentTier = RECOMMENDATION_TIER_SCORE[current.tier];
        const nextTier = RECOMMENDATION_TIER_SCORE[recommendation.tier];

        if (
          nextTier > currentTier ||
          (nextTier === currentTier && recommendation.score > current.score)
        ) {
          bestByIdeology.set(ideology, recommendation);
        }
      }
    }

    const byCell = new Map<string, PlacementRecommendation>();

    for (const recommendation of bestByIdeology.values()) {
      const existing = byCell.get(recommendation.cellId);

      if (!existing) {
        byCell.set(recommendation.cellId, recommendation);
        continue;
      }

      const existingTier = RECOMMENDATION_TIER_SCORE[existing.tier];
      const nextTier = RECOMMENDATION_TIER_SCORE[recommendation.tier];

      if (
        nextTier > existingTier ||
        (nextTier === existingTier && recommendation.score > existing.score)
      ) {
        byCell.set(recommendation.cellId, recommendation);
      }
    }

    return byCell;
  }

  private renderPatternVisualization(
    state: GameState,
    hoverPreview: ReturnType<typeof getPlacementPreview>
  ): void {
    if (
      !this.patternGhostGraphics ||
      !this.patternFillGraphics ||
      !this.patternLineGraphics ||
      !this.patternNodeGraphics
    ) {
      return;
    }

    const selectedBuildStructureId = getSelectedBuildStructureId(state);
    const visualization = buildPatternVisualization(
      state.board,
      state.patterns,
      hoverPreview ? null : selectedBuildStructureId
    );

    this.patternGhostGraphics.clear();
    this.patternFillGraphics.clear();
    this.patternLineGraphics.clear();
    this.patternNodeGraphics.clear();

    if (state.boardViewMode !== "pattern") {
      return;
    }

    const activeScrapCells = this.getActivePatternCells(state, "scrap");
    const activeTechCells = this.getActivePatternCells(state, "tech");
    const activeMagicCells = this.getActivePatternCells(state, "magic");
    const visibleCellIds = new Set<string>();

    const drawVisibleBlob = (
      blob: VisualizationBlob | null,
      graphics: Phaser.GameObjects.Graphics
    ): void => {
      if (!blob) {
        return;
      }

      blob.cellIds.forEach((cellId) => visibleCellIds.add(cellId));
      this.drawScrapBlob(graphics, blob);
    };
    const drawVisibleStroke = (
      stroke: VisualizationStroke | null,
      graphics: Phaser.GameObjects.Graphics,
      renderer: (graphicsRef: Phaser.GameObjects.Graphics, strokeRef: VisualizationStroke) => void
    ): void => {
      if (!stroke) {
        return;
      }

      stroke.cellIds.forEach((cellId) => visibleCellIds.add(cellId));
      renderer(graphics, stroke);
    };

    if (hoverPreview) {
      this.drawProjectedVisualization(
        hoverPreview,
        activeScrapCells,
        activeTechCells,
        activeMagicCells,
        visibleCellIds
      );
    } else {
      drawVisibleBlob(
        this.pickBestBlob(visualization.scrapBlobs, activeScrapCells, true),
        this.patternGhostGraphics
      );
      drawVisibleStroke(
        this.pickBestStroke(visualization.techPaths, activeTechCells, true),
        this.patternGhostGraphics,
        (graphics, path) => this.drawTechPath(graphics, path)
      );
      drawVisibleStroke(
        this.pickBestStroke(visualization.magicPaths, activeMagicCells, true),
        this.patternGhostGraphics,
        (graphics, path) => this.drawMagicPath(graphics, path)
      );
    }

    drawVisibleBlob(
      this.pickBestBlob(visualization.scrapBlobs, activeScrapCells, false),
      this.patternFillGraphics
    );
    drawVisibleStroke(
      this.pickBestStroke(visualization.magicPaths, activeMagicCells, false),
      this.patternLineGraphics,
      (graphics, path) => this.drawMagicPath(graphics, path)
    );
    drawVisibleStroke(
      this.pickBestStroke(visualization.techPaths, activeTechCells, false),
      this.patternLineGraphics,
      (graphics, path) => this.drawTechPath(graphics, path)
    );

    this.drawPatternNodes(visualization, visibleCellIds);
  }

  private drawProjectedVisualization(
    preview: NonNullable<ReturnType<typeof getPlacementPreview>>,
    activeScrapCells: Set<string>,
    activeTechCells: Set<string>,
    activeMagicCells: Set<string>,
    visibleCellIds: Set<string>
  ): void {
    if (!this.patternGhostGraphics) {
      return;
    }

    const previewAnchor = preview.visualization.anchors.find(
      (anchor) => anchor.cellId === preview.cellId
    );

    if (!previewAnchor) {
      return;
    }

    const localPoint = previewAnchor.point;
    const isNearPreviewPoint = (point: VisualizationPoint): boolean => {
      const rowDelta = point.y - localPoint.y;
      const colDelta = point.x - localPoint.x;

      return Math.sqrt(rowDelta * rowDelta + colDelta * colDelta) <= 1.55;
    };
    const projectedBlob = this.pickBestBlob(
      preview.visualization.scrapBlobs.filter(
        (entry) =>
          entry.projected &&
          entry.circles.some((circle) => isNearPreviewPoint(circle.point))
      ),
      activeScrapCells,
      true
    );
    const projectedTech = this.pickBestStroke(
      preview.visualization.techPaths.filter(
        (entry) =>
          entry.projected &&
          entry.points.some((point) => isNearPreviewPoint(point))
      ),
      activeTechCells,
      true
    );
    const projectedMagic = this.pickBestStroke(
      preview.visualization.magicPaths.filter(
        (entry) =>
          entry.projected &&
          entry.points.some((point) => isNearPreviewPoint(point))
      ),
      activeMagicCells,
      true
    );

    if (projectedBlob) {
      projectedBlob.cellIds.forEach((cellId) => visibleCellIds.add(cellId));
      this.drawScrapBlob(this.patternGhostGraphics, projectedBlob);
    }

    if (projectedTech) {
      projectedTech.cellIds.forEach((cellId) => visibleCellIds.add(cellId));
      this.drawTechPath(this.patternGhostGraphics, projectedTech);
    }

    if (projectedMagic) {
      projectedMagic.cellIds.forEach((cellId) => visibleCellIds.add(cellId));
      this.drawMagicPath(this.patternGhostGraphics, projectedMagic);
    }
  }

  private drawScrapBlob(
    graphics: Phaser.GameObjects.Graphics,
    blob: VisualizationBlob
  ): void {
    const color = getIdeologyColor("scrap");
    const fillAlpha = blob.projected
      ? 0.09 + blob.reinforcement * 0.02
      : blob.emphasized
        ? 0.2 + blob.reinforcement * 0.03
        : 0.13 + blob.reinforcement * 0.02;
    const lineAlpha = blob.projected ? 0.16 : blob.emphasized ? 0.3 : 0.21;

    graphics.fillStyle(color, fillAlpha);

    for (const circle of blob.circles) {
      const point = this.toPixelPoint(circle.point);
      graphics.fillCircle(point.x, point.y, circle.radius * this.radialScale * 0.56);
    }

    for (const bridge of blob.bridges) {
      const from = this.toPixelPoint(bridge.from);
      const to = this.toPixelPoint(bridge.to);
      graphics.lineStyle(
        Math.max(8, bridge.width * this.radialScale * 0.46),
        color,
        lineAlpha
      );
      graphics.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  private drawTechPath(
    graphics: Phaser.GameObjects.Graphics,
    path: VisualizationStroke
  ): void {
    const color = getIdeologyColor("tech");
    const lineWidth = 4.5 + (path.emphasized ? 2.1 : 0.8) + path.reinforcement * 1.3;
    const alpha = path.projected ? 0.27 : path.emphasized ? 0.92 : 0.6;
    const points = path.points.map((point) => this.toPixelPoint(point));

    graphics.lineStyle(lineWidth, color, alpha);
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);

    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }

    graphics.strokePath();
  }

  private drawMagicPath(
    graphics: Phaser.GameObjects.Graphics,
    path: VisualizationStroke
  ): void {
    const color = getIdeologyColor("magic");
    const alpha = path.projected ? 0.23 : path.emphasized ? 0.9 : 0.58;
    const lineWidth = 3.8 + (path.emphasized ? 1.7 : 0.6) + path.reinforcement * 0.9;
    const controlPoints = path.points.map((point) => this.toPixelPoint(point));
    const curve = new Phaser.Curves.Spline(controlPoints);
    const sampledPoints = curve.getPoints(path.closed ? 30 : 20);

    graphics.lineStyle(lineWidth, color, alpha);

    if (path.closed) {
      graphics.fillStyle(color, path.projected ? 0.03 : 0.065 + path.reinforcement * 0.01);
      graphics.fillPoints(sampledPoints, true, true);
    }

    graphics.strokePoints(sampledPoints, path.closed, true);
  }

  private drawPatternNodes(
    visualization: PatternVisualization,
    visibleCellIds: Set<string>
  ): void {
    if (!this.patternNodeGraphics) {
      return;
    }

    for (const anchor of visualization.anchors.filter(
      (entry) => !entry.projected && visibleCellIds.has(entry.cellId)
    )) {
      const point = this.toPixelPoint(anchor.point);

      this.patternNodeGraphics.fillStyle(0x2f2f2f, 0.2);
      this.patternNodeGraphics.fillCircle(point.x, point.y, 2.9);

      if (!anchor.nodeIdeology) {
        continue;
      }

      const color = getIdeologyColor(anchor.nodeIdeology);

      if (anchor.nodeIdeology === "scrap") {
        this.patternNodeGraphics.lineStyle(2, color, 0.5);
        this.patternNodeGraphics.strokeCircle(point.x, point.y, 16);
      } else if (anchor.nodeIdeology === "tech") {
        this.patternNodeGraphics.lineStyle(2.4, color, 0.55);
        this.patternNodeGraphics.strokeRect(point.x - 11, point.y - 11, 22, 22);
      } else {
        this.patternNodeGraphics.lineStyle(2.4, color, 0.55);
        this.patternNodeGraphics.strokeCircle(point.x, point.y, 15);
        this.patternNodeGraphics.strokeCircle(point.x, point.y, 9);
      }
    }

    for (const junction of visualization.techJunctions.filter(
      (entry) => visibleCellIds.has(entry.cellId)
    )) {
      const point = this.toPixelPoint(junction.point);
      const color = getIdeologyColor("tech");
      const size = junction.emphasized ? 12 : 9;

      this.patternNodeGraphics.lineStyle(
        junction.emphasized ? 2.4 : 1.9,
        color,
        junction.projected ? 0.32 : 0.74
      );
      this.patternNodeGraphics.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
    }
  }

  private renderBuildCell(
    state: GameState,
    cell: GameState["board"][number],
    view: CellView,
    maintenance: ReturnType<typeof getMaintenanceCellState>,
    palette: ReturnType<SettlementScene["getBuildModePalette"]>
  ): void {
    if (cell.terrain === "core") {
      view.labelText.setText("CORE");
      view.detailText.setText("Settlement heart");
      view.conditionText.setText("");
    } else if (cell.structureId) {
      const definition = getStructureCardDefinition(cell.structureId);
      const status =
        cell.condition <= 1 ? "DAMAGED" : cell.condition === 2 ? "WORN" : "HEALTHY";
      const connectionProfile = this.getConnectionProfile(state, cell);
      const ideologyLabel =
        cell.appliedIdeology === "tech"
          ? "TECH"
          : cell.appliedIdeology === "magic"
            ? "MAGIC"
            : "NEUTRAL";

      view.labelText.setText(definition.boardLabel);
      view.detailText.setText(`${definition.title} | ${ideologyLabel} | S${cell.stackLevel} | L${connectionProfile.total}/3`);
      view.conditionText.setText(`${status} ${cell.condition}/3`);
    } else if (cell.damage === "ruined") {
      view.labelText.setText("RUIN");
      view.detailText.setText("Ruined");
      view.conditionText.setText("0/3");
    } else {
      view.labelText.setText("");
      view.detailText.setText(MAINTENANCE_LABELS[maintenance.tier]);
      view.conditionText.setText("");
    }

    view.labelText.setVisible(true).setColor(palette.titleColor);
    view.detailText.setVisible(true).setColor(palette.detailColor);
    view.conditionText.setVisible(true).setColor(palette.conditionColor);
  }

  private renderPatternCell(view: CellView): void {
    view.labelText.setVisible(false).setText("");
    view.detailText.setVisible(false).setText("");
    view.conditionText.setVisible(false).setText("");
  }

  private renderState(state: GameState): void {
    const hoverPreview = this.hoveredCellId
      ? getPlacementPreview(state, this.hoveredCellId)
      : null;
    const recommendationMap = this.getVisibleRecommendationMap(state);

    if (this.lastBoardViewMode !== state.boardViewMode) {
      this.animateBoardViewTransition(state.boardViewMode);
      this.lastBoardViewMode = state.boardViewMode;
    }

    if (this.backdropPanel && this.titleText && this.subtitleText && this.footerText) {
      if (state.boardViewMode === "build") {
        this.backdropPanel.setFillStyle(0xf4f0e8, 1).setStrokeStyle(3, 0x171411, 1);
        this.titleText.setText("Radial Settlement").setColor("#171411");
        this.subtitleText
          .setText("Build View: shape the settlement around the Core and keep support lines healthy.")
          .setColor("#45403a");
        this.footerText.setColor("#2e2823");
      } else {
        this.backdropPanel.setFillStyle(0xffffff, 1).setStrokeStyle(3, 0xd8d8d8, 1);
        this.titleText.setText("Pattern Canvas").setColor("#171411");
        this.subtitleText
          .setText("Pattern View: Scrap clusters, Tech routes, and Magic resonance reveal planning opportunities.")
          .setColor("#5a5651");
        this.footerText.setColor("#3b3732");
      }
    }

    this.drawRingGuides(state);
    this.drawConnectionLinks(state);
    this.renderPatternVisualization(state, hoverPreview);
    this.drawPlacementGhost(state, hoverPreview);
    this.renderPatternPips(state);
    this.renderHoverTooltip(state, hoverPreview);

    for (const cell of state.board) {
      const view = this.cellViews.get(cell.id);

      if (!view) {
        continue;
      }

      const isSelected =
        state.selectedTile?.row === cell.row && state.selectedTile?.col === cell.col;
      const isHovered = this.hoveredCellId === cell.id;
      const activeHighlights = state.patterns.tileHighlights[cell.id] ?? [];
      const maintenance = getMaintenanceCellState(state.boardSize, cell);

      if (state.boardViewMode === "build") {
        const palette = this.getBuildModePalette(cell, isSelected);

        view.baseDisk.setFillStyle(palette.fill, isHovered ? 1 : 0.98);
        view.baseDisk.setStrokeStyle(2, palette.stroke, isHovered ? 1 : 0.92);
        view.coreHalo.setVisible(cell.terrain === "core");
        this.renderBuildCell(state, cell, view, maintenance, palette);

        if (hoverPreview && cell.id === hoverPreview.cellId && !cell.structureId) {
          const definition = getStructureCardDefinition(hoverPreview.structureId);

          view.labelText.setText(definition.boardLabel);
          view.detailText.setText(hoverPreview.patternSummary);
          view.conditionText.setText(hoverPreview.maintenanceSummary);
          view.labelText.setColor("#171411");
          view.detailText.setColor("#5a4e43");
          view.conditionText.setColor("#9b6338");
        }
      } else {
        const palette = this.getPatternModePalette(cell, isSelected);

        view.baseDisk.setFillStyle(palette.fill, isHovered ? 1 : 0.98);
        view.baseDisk.setStrokeStyle(1.6, palette.stroke, isHovered ? 1 : 0.94);
        view.coreHalo.setVisible(cell.terrain === "core");
        this.renderPatternCell(view);
      }

      view.scrapAccentDot
        .setVisible(state.boardViewMode === "build" && activeHighlights.includes("scrap"))
        .setAlpha(0.86);
      view.techAccentDot
        .setVisible(state.boardViewMode === "build" && activeHighlights.includes("tech"))
        .setAlpha(0.86);
      view.magicAccentDot
        .setVisible(state.boardViewMode === "build" && activeHighlights.includes("magic"))
        .setAlpha(0.86);

      const recommendation = recommendationMap.get(cell.id);

      if (
        state.boardViewMode === "pattern" &&
        recommendation &&
        state.phase === "build" &&
        (!hoverPreview || recommendation.cellId === hoverPreview.cellId)
      ) {
        const stroke = RECOMMENDATION_STROKES[recommendation.tier];

        view.recommendationRing
          .setVisible(true)
          .setStrokeStyle(stroke.width, stroke.color, stroke.alpha);
      } else {
        view.recommendationRing.setVisible(false);
      }

      if (isHovered && state.phase === "build") {
        const hoverStroke =
          hoverPreview
            ? hoverPreview.upkeepDelta > 0
              ? 0xb15f33
              : 0x3f6a55
            : cell.terrain === "core"
              ? 0x8b8171
              : cell.structureId
                ? cell.condition <= 1
                  ? 0x7b2f24
                  : cell.condition === 2
                    ? 0x7a6552
                    : 0x54504a
                : cell.damage === "ruined"
                  ? 0x8a6c58
                  : 0x6d6861;

        view.hoverRing.setVisible(true).setStrokeStyle(2.2, hoverStroke, 0.92);
      } else {
        view.hoverRing.setVisible(false);
      }

      const selectionStroke =
        state.boardViewMode === "pattern"
          ? this.getPatternModePalette(cell, isSelected).stroke
          : this.getBuildModePalette(cell, isSelected).stroke;

      view.selectionRing.setStrokeStyle(
        isSelected ? 3.8 : 2,
        isSelected ? 0x111111 : selectionStroke,
        1
      );
    }

    if (!this.footerText) {
      return;
    }

    const selectedBuildStructureId = getSelectedBuildStructureId(state);
    const emptyTileCount = getEmptyTileCount(state);

    if (state.phase !== "build") {
      this.footerText.setText(
        "Raid flow is active. Build and dismantle actions resume after combat resolves."
      );
      return;
    }

    if (emptyTileCount === 0) {
      this.footerText.setText("No open sites remain. Salvage or dismantle to make room.");
      return;
    }

    if (state.boardViewMode === "pattern") {
      if (selectedBuildStructureId) {
        const definition = getStructureCardDefinition(selectedBuildStructureId);

        if (hoverPreview) {
          this.footerText.setText(
            `${definition.title}: ${hoverPreview.patternSummary}. ${hoverPreview.maintenanceSummary}.`
          );
        } else if (state.patterns.placementRecommendations.length > 0) {
          this.footerText.setText(
            `${definition.title}: hover open sectors to preview projected routes, arcs, and cluster growth.`
          );
        } else {
          this.footerText.setText(
            `${definition.title}: no strong projection yet. Build near existing ideology shapes.`
          );
        }

        return;
      }

      this.footerText.setText(
        "Pattern View highlights topology: Tech routes, Magic resonance, and Scrap mass cohesion."
      );
      return;
    }

    if (state.selectedIdeologyCard) {
      this.footerText.setText(
        `${state.selectedIdeologyCard === "tech" ? "Tech" : "Magic"} card armed: click a built structure to apply or remove that ideology.`
      );
      return;
    }

    if (selectedBuildStructureId) {
      const definition = getStructureCardDefinition(selectedBuildStructureId);

      if (hoverPreview) {
        this.footerText.setText(
          `${definition.title}: ${hoverPreview.patternSummary}. ${hoverPreview.maintenanceSummary}. Click to place or salvage instead.`
        );
      } else {
        this.footerText.setText(
          `${definition.title} armed. Hover an open sector to preview placement, or salvage instead.`
        );
      }

      return;
    }

    const builtStructureCount = state.board.filter(
      (cell) => cell.structureId !== null && cell.terrain !== "core"
    ).length;

    if (builtStructureCount >= 2) {
      this.footerText.setText(
        "Drag from one built structure to another to create or remove plain connections."
      );
      return;
    }

    if (state.selectedTile) {
      const selectedCell = state.board.find(
        (cell) =>
          cell.row === state.selectedTile?.row &&
          cell.col === state.selectedTile?.col
      );

      if (selectedCell?.terrain === "core") {
        this.footerText.setText(
          "The Core anchors the settlement. Build around it and avoid unsupported overreach."
        );
        return;
      }

      if (selectedCell?.structureId) {
        this.footerText.setText(
          `${getStructureCardDefinition(selectedCell.structureId).title} selected. You can keep it, repair later, or dismantle for a refund.`
        );
        return;
      }

      this.footerText.setText(
        "Open sector selected. Build here or switch to Pattern View for topology planning."
      );
      return;
    }

    const activePatternCount = Object.values(state.patterns.byIdeology).filter(Boolean).length;

    if (activePatternCount > 0) {
      this.footerText.setText(
        `${activePatternCount} active pattern${activePatternCount === 1 ? "" : "s"} detected. Use Pattern View to plan the next placement.`
      );
      return;
    }

    this.footerText.setText(
      "Expand ring by ring from the Core and keep frontier support from collapsing."
    );
  }
}
