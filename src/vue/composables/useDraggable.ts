import { onBeforeUnmount, reactive, ref, type Ref } from "vue";

/**
 * 通用面板拖拽 Hook —— 替代原生 `DraggableFrame` 的 DOM 事件坐标监听。
 *
 * 用法：
 * ```ts
 * const panel = ref<HTMLElement | null>(null);
 * const { dragging, position, onMousedown } = useDraggable(panel);
 * ```
 * 在模板中把 `onMousedown` 绑定到拖拽手柄，把 `position` 应用到面板
 * 的 `left/top` 样式即可。
 */
export function useDraggable(target: Ref<HTMLElement | null>) {
  const dragging = ref(false);
  const position = reactive({ x: 0, y: 0 });

  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;

  const onMousemove = (e: MouseEvent) => {
    if (!dragging.value) return;
    // 与 DraggableFrame 行为一致：面板保持按下时鼠标相对面板的偏移跟随移动
    position.x = e.clientX - offsetX;
    position.y = e.clientY - offsetY;
  };

  const onMouseup = () => {
    if (!dragging.value) return;
    dragging.value = false;
    document.removeEventListener("mousemove", onMousemove);
    document.removeEventListener("mouseup", onMouseup);
  };

  const onMousedown = (e: MouseEvent) => {
    const el = target.value;
    if (!el) return;
    dragging.value = true;
    startX = e.clientX;
    startY = e.clientY;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    document.addEventListener("mousemove", onMousemove);
    document.addEventListener("mouseup", onMouseup);
    e.preventDefault();
  };

  onBeforeUnmount(() => {
    document.removeEventListener("mousemove", onMousemove);
    document.removeEventListener("mouseup", onMouseup);
  });

  return { dragging, position, onMousedown, startX, startY };
}
