"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

/**
 * Покраска ячеек мышью — как в графике выходных на /settings/users.
 *
 * Зажал ЛКМ → провёл по сетке → отпустил: все задетые ячейки получают
 * одно и то же значение. Один штрих = ОДИН запрос на сервер и ОДИН шаг
 * в истории отмены (иначе Ctrl+Z пришлось бы жать по разу на ячейку).
 *
 * Хелпер общий, потому что механика одинакова у всех сеток
 * «строка × день»: журнал знает, какое значение положить в ячейку, а
 * хук — как поймать штрих, собрать его и не спутать с обычным тапом.
 *
 * Где покраска НЕ нужна: если ячейка — это ввод числа или текста
 * (температура в холодильниках, время в чек-листе), протягивание не
 * имеет смысла — «одно значение на весь штрих» там не бывает. Такие
 * сетки хук не подключают.
 *
 * Состояние штриха живёт в ref, а не в state: pointermove не должен
 * ждать перерисовку сетки на 31×N ячеек.
 */
export type PaintCellRef = {
  rowId: string;
  colKey: string;
};

export type PaintCell<TData> = PaintCellRef & { data: TData };

export type CellPaintStroke<TData, TIntent> = {
  /** Тип ряда ячеек: смешивать разные в одном штрихе нельзя. */
  kind: string;
  /** Что именно красим — решает журнал по якорной ячейке. */
  intent: TIntent;
  /** Курсор ушёл на другую ячейку — значит это штрих, а не тап. */
  moved: boolean;
  anchor: PaintCellRef;
  cells: Map<string, PaintCell<TData>>;
  previous: Map<string, TData | undefined>;
};

export type CellPaintOptions<TData, TIntent> = {
  /** Журнал закрыт / нет прав — покраска и тапы выключены. */
  enabled: boolean;
  /** Порядок строк и колонок — по нему считается Shift-прямоугольник. */
  rowIds: () => string[];
  colKeys: () => string[];
  cellKey: (rowId: string, colKey: string) => string;
  /** Запертый прошлый день: не красим и не тапаем. */
  isLocked?: (rowId: string, colKey: string) => boolean;
  /** Показать «прошлые дни закрыты» при клике по запертой ячейке. */
  onLocked?: (rowId: string, colKey: string) => void;
  /**
   * Что красим этим штрихом. `null` — ячейка не участвует в покраске
   * (например, служебная строка), тогда штрих не начинается.
   */
  beginStroke: (rowId: string, colKey: string, kind: string) => TIntent | null;
  /** Значение конкретной ячейки для текущего штриха. */
  buildCell: (
    stroke: CellPaintStroke<TData, TIntent>,
    rowId: string,
    colKey: string
  ) => TData;
  /** Текущее значение ячейки — уходит в previous для отмены. */
  readCell: (rowId: string, colKey: string) => TData | undefined;
  /** Оптимистично показать покрашенное, не дожидаясь сервера. */
  applyLocal: (cells: Array<PaintCell<TData>>) => void;
  /** Клик без протягивания — прежнее поведение ячейки (цикл статусов). */
  onTap: (rowId: string, colKey: string, kind: string) => void;
  /** Конец штриха: один запрос на все ячейки. */
  onCommit: (
    cells: Array<PaintCell<TData>>,
    previous: Map<string, TData | undefined>
  ) => void;
};

/** data-атрибуты ячейки: по ним `elementFromPoint` находит, куда попал курсор. */
const CELL_ATTR = "data-paint-cell";
const ROW_ATTR = "data-paint-row";
const COL_ATTR = "data-paint-col";
const KIND_ATTR = "data-paint-kind";

export type CellPaintApi<TData> = {
  /** Ref на контейнер листа — он ловит pointer capture. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Идёт штрих: контейнеру нужен crosshair и запрет выделения текста. */
  painting: boolean;
  /** Пропсы контейнера (pointermove/up/cancel). */
  containerProps: {
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
  };
  /**
   * Пропсы ячейки. `interactive: false` — ячейка не красится и не
   * тапается (пустая строка бланка, служебная колонка).
   */
  cellProps: (
    rowId: string,
    colKey: string,
    kind: string,
    interactive: boolean
  ) => Record<string, unknown>;
  /** Ячейки текущего штриха — чтобы журнал мог их подсветить. */
  strokeCells: () => Array<PaintCell<TData>>;
};

export function useCellPaint<TData, TIntent>(
  options: CellPaintOptions<TData, TIntent>
): CellPaintApi<TData> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<CellPaintStroke<TData, TIntent> | null>(null);
  // Якорь живёт МЕЖДУ штрихами: Shift+клик тянет прямоугольник от
  // последней тронутой ячейки, как в графике выходных.
  const lastAnchorRef = useRef<(PaintCellRef & { kind: string }) | null>(null);
  const [painting, setPainting] = useState(false);

  // Опции держим в ref: хендлеры вешаются на JSX каждый рендер, но сам
  // штрих не должен зависеть от того, пересоздались ли колбэки.
  // Обновляем в эффекте, а не по ходу рендера: писать в ref во время
  // рендера React запрещает, а обработчики всё равно срабатывают позже.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const paintCell = useCallback(
    (
      stroke: CellPaintStroke<TData, TIntent>,
      rowId: string,
      colKey: string
    ) => {
      const opts = optionsRef.current;
      const key = opts.cellKey(rowId, colKey);
      if (stroke.cells.has(key)) return;
      // Запертые дни не красим вовсе — сервер их всё равно пропустит.
      if (opts.isLocked?.(rowId, colKey)) return;
      stroke.previous.set(key, opts.readCell(rowId, colKey));
      const cell = { rowId, colKey, data: opts.buildCell(stroke, rowId, colKey) };
      stroke.cells.set(key, cell);
      opts.applyLocal([cell]);
    },
    []
  );

  /** Shift+клик — прямоугольник от прошлого якоря до текущей ячейки. */
  const paintRect = useCallback(
    (
      stroke: CellPaintStroke<TData, TIntent>,
      from: PaintCellRef,
      to: PaintCellRef
    ) => {
      const opts = optionsRef.current;
      const rowIds = opts.rowIds();
      const colKeys = opts.colKeys();
      const r1 = rowIds.indexOf(from.rowId);
      const r2 = rowIds.indexOf(to.rowId);
      const c1 = colKeys.indexOf(from.colKey);
      const c2 = colKeys.indexOf(to.colKey);
      if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return;
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r += 1) {
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c += 1) {
          paintCell(stroke, rowIds[r], colKeys[c]);
        }
      }
    },
    [paintCell]
  );

  const cellFromPoint = useCallback((x: number, y: number) => {
    const element = document.elementFromPoint(x, y);
    const cell =
      element instanceof HTMLElement
        ? element.closest<HTMLElement>(`[${CELL_ATTR}]`)
        : null;
    const rowId = cell?.getAttribute(ROW_ATTR);
    const colKey = cell?.getAttribute(COL_ATTR);
    const kind = cell?.getAttribute(KIND_ATTR);
    if (!rowId || !colKey || !kind) return null;
    return { rowId, colKey, kind };
  }, []);

  /**
   * Начало взаимодействия с ячейкой. Пока курсор не ушёл на соседнюю
   * ячейку — это обычный тап (прежний цикл значений); как только ушёл,
   * превращается в штрих покраски.
   */
  const handleCellPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      rowId: string,
      colKey: string,
      kind: string,
      interactive: boolean
    ) => {
      const opts = optionsRef.current;
      if (!opts.enabled || !interactive) return;
      // ПКМ покраску не запускает — там своё меню выбора значения.
      if (event.button !== 0) return;
      if (opts.isLocked?.(rowId, colKey)) {
        opts.onLocked?.(rowId, colKey);
        return;
      }
      const intent = opts.beginStroke(rowId, colKey, kind);
      if (intent === null) return;
      // Иначе браузер начнёт выделять текст таблицы вместо покраски.
      event.preventDefault();

      const stroke: CellPaintStroke<TData, TIntent> = {
        kind,
        intent,
        moved: false,
        anchor: { rowId, colKey },
        cells: new Map(),
        previous: new Map(),
      };
      strokeRef.current = stroke;

      const previousAnchor = lastAnchorRef.current;
      if (event.shiftKey && previousAnchor && previousAnchor.kind === kind) {
        paintRect(stroke, previousAnchor, { rowId, colKey });
        stroke.moved = true;
        setPainting(true);
      }

      lastAnchorRef.current = { rowId, colKey, kind };
      containerRef.current?.setPointerCapture(event.pointerId);
    },
    [paintRect]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const stroke = strokeRef.current;
      if (!stroke) return;
      const cell = cellFromPoint(event.clientX, event.clientY);
      if (!cell || cell.kind !== stroke.kind) return;
      const sameAsAnchor =
        cell.rowId === stroke.anchor.rowId && cell.colKey === stroke.anchor.colKey;
      if (sameAsAnchor && !stroke.moved) return;

      if (!stroke.moved) {
        stroke.moved = true;
        setPainting(true);
        paintCell(stroke, stroke.anchor.rowId, stroke.anchor.colKey);
      }
      paintCell(stroke, cell.rowId, cell.colKey);
      lastAnchorRef.current = { rowId: cell.rowId, colKey: cell.colKey, kind: stroke.kind };
    },
    [cellFromPoint, paintCell]
  );

  /**
   * Конец взаимодействия: тап — прежний цикл значений, штрих — один
   * запрос и один шаг в истории отмены.
   */
  const finishStroke = useCallback(() => {
    const stroke = strokeRef.current;
    if (!stroke) return;
    strokeRef.current = null;
    setPainting(false);

    const opts = optionsRef.current;
    if (!stroke.moved) {
      opts.onTap(stroke.anchor.rowId, stroke.anchor.colKey, stroke.kind);
      return;
    }
    opts.onCommit([...stroke.cells.values()], stroke.previous);
  }, []);

  const cellProps = useCallback(
    (rowId: string, colKey: string, kind: string, interactive: boolean) => ({
      [CELL_ATTR]: interactive ? "" : undefined,
      [ROW_ATTR]: rowId,
      [COL_ATTR]: colKey,
      [KIND_ATTR]: kind,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) =>
        handleCellPointerDown(event, rowId, colKey, kind, interactive),
    }),
    [handleCellPointerDown]
  );

  return {
    containerRef,
    painting,
    containerProps: {
      onPointerMove: handlePointerMove,
      onPointerUp: finishStroke,
      onPointerCancel: finishStroke,
      onLostPointerCapture: finishStroke,
    },
    cellProps,
    strokeCells: () => [...(strokeRef.current?.cells.values() ?? [])],
  };
}
