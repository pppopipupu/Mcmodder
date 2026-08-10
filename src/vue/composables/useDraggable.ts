import { onBeforeUnmount, reactive, ref, type Ref } from "vue";

export function useDraggable(target: Ref<HTMLElement | null>) {
  const dragging = ref(false);
  const position = reactive({ x: 0, y: 0 });

  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;

  const onMousemove = (e: MouseEvent) => {
    if (!dragging.value) return;
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
