<template>
  <div
    class="mcmodder-contextmenu"
    :class="{
      'expand-right': expandRight,
      'expand-left': expandLeft,
      'faded': faded,
      'hidden': hidden
    }"
    :style="{ left: x + 'px', top: y + 'px' }"
    tabindex="-1"
    @keydown="onKeydown"
  >
    <div class="mcmodder-contextmenu-inner">
      <div class="arrow" />
      <ul>
        <li v-if="!visibleItems.length" class="empty">当前无可用选项...</li>
        <template v-for="(entry, i) in visibleItems" :key="entry.key">
          <li
            :class="{ selected: selected === i }"
            @mousemove="onItemMousemove(i)"
            @mouseleave="onItemMouseleave(i)"
            @click="onItemClick(i)"
          >
            <i v-if="entry.iconGlyph" class="mcmodder-contextmenu-icon">{{ entry.iconGlyph }}</i>
            <a>{{ entry.text }}</a>
            <span v-if="entry.shortcut" class="item-shortcut-left" v-html="entry.shortcutHTML" />
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { McmodderUtils } from "../../Utils";
import type { ContextMenuEntry, ContextMenuExpose } from "../../widget/ContextMenu";

/**
 * 右键上下文弹出菜单 —— 替代原 `McmodderContextMenu` 的手写 DOM 渲染。
 *
 * 事件入口（容器 contextmenu / 键盘）仍由 `ContextMenu.ts` 适配器持有，
 * 本组件负责菜单的渲染、选中态与定位动画。
 */

export interface ContextMenuExposeInner {
  show: (x: number, y: number, activeIndexList: number[], entries: ContextMenuEntry[], event: unknown) => Promise<void>;
  hide: () => void;
  getActiveState: () => boolean;
}

const props = defineProps<{
  /** 菜单定位所参照的容器元素 */
  container: HTMLElement;
  /** 组件就绪后回调，向适配器暴露命令接口 */
  onReady?: (api: ContextMenuExpose) => void;
}>();

const x = ref(0);
const y = ref(0);
const hidden = ref(true);
const faded = ref(false);
const expandRight = ref(false);
const expandLeft = ref(false);
const selected = ref(-1);
const active = ref(false);

/** 当前可见的菜单项 */
const visibleItems = ref<ContextMenuEntry[]>([]);
/** 可见项在原 items 列表中的索引（保持与旧 API 语义一致） */
const activeIndexList = ref<number[]>([]);
let contextmenuEvent: unknown = null;

const root = ref<HTMLElement | null>(null);
let hideTimer: number | undefined;

const pressArrowKeyBeforeMouseMove = ref(true);

onMounted(() => {
  props.onReady?.({
    show,
    hide,
    getActiveState
  });
});

const selectedEntry = computed(() =>
  selected.value >= 0 && selected.value < visibleItems.value.length
    ? visibleItems.value[selected.value]
    : null
);

async function show(
  _x: number,
  _y: number,
  _activeIndexList: number[],
  entries: ContextMenuEntry[],
  event: unknown
) {
  active.value = true;
  activeIndexList.value = _activeIndexList;
  visibleItems.value = entries;
  contextmenuEvent = event;
  hidden.value = false;
  faded.value = false;
  expandLeft.value = false;
  expandRight.value = false;
  selected.value = -1;
  pressArrowKeyBeforeMouseMove.value = true;
  x.value = _x + 2 * getEm();
  y.value = _y - 0.95 * getEm();

  await nextTick();
  root.value?.focus();

  // 依据菜单与容器边界决定箭头方向（与原实现一致）
  if (_x && _y) {
    const menuRect = root.value?.getBoundingClientRect();
    const containerRect = props.container?.getBoundingClientRect();
    if (!menuRect || !containerRect) return;
    if (menuRect.right <= containerRect.right) {
      expandRight.value = true;
    } else {
      expandLeft.value = true;
      x.value = _x - 1.9 * getEm() - menuRect.width;
      y.value = _y - 0.95 * getEm();
    }
  }
}

function hide() {
  active.value = false;
  faded.value = true;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (!active.value) hidden.value = true;
  }, 200);
}

function getActiveState() {
  return active.value;
}

function getEm() {
  const el = root.value;
  if (!el) return 14;
  const size = getComputedStyle(el).fontSize;
  return Number(size.slice(0, -2)) || 14;
}

function triggerEntry(entry: ContextMenuEntry | null) {
  if (!entry) return;
  entry.callback(contextmenuEvent);
  window.setTimeout(() => {
    selected.value = -1;
  }, 200);
}

function onKeydown(e: KeyboardEvent) {
  // 快捷键直接触发
  for (const entry of visibleItems.value) {
    const shortcut = entry.shortcut;
    if (shortcut && McmodderUtils.isKeyMatch(shortcut, e)) {
      triggerEntry(entry);
      return;
    }
  }
  if (McmodderUtils.isKeyMatch({ keyCode: 13 }, e)) {
    if (selected.value != -1) {
      triggerEntry(selectedEntry.value);
    }
  } else if (McmodderUtils.isKeyMatch({ keyCode: 27 }, e)) {
    e.preventDefault();
    root.value?.blur();
    hide();
  } else if (McmodderUtils.isKeyMatch({ keyCode: 40 }, e)) {
    e.preventDefault();
    e.stopPropagation();
    if (!visibleItems.value.length) return;
    pressArrowKeyBeforeMouseMove.value = true;
    if (selected.value === -1) {
      selected.value = 0;
    } else {
      selected.value = Math.min(selected.value + 1, visibleItems.value.length - 1);
    }
  } else if (McmodderUtils.isKeyMatch({ keyCode: 38 }, e)) {
    e.preventDefault();
    e.stopPropagation();
    if (!visibleItems.value.length) return;
    pressArrowKeyBeforeMouseMove.value = true;
    if (selected.value === -1) {
      selected.value = visibleItems.value.length - 1;
    } else {
      selected.value = Math.max(selected.value - 1, 0);
    }
  }
}

function onItemMousemove(index: number) {
  if (!pressArrowKeyBeforeMouseMove.value) return;
  selected.value = index;
}

function onItemMouseleave(index: number) {
  if (selected.value === index) selected.value = -1;
}

function onItemClick(index: number) {
  triggerEntry(visibleItems.value[index]);
}

defineExpose({
  show,
  hide,
  getActiveState
});
</script>

<style scoped>
.mcmodder-contextmenu {
  position: absolute;
  top: 0;
  z-index: 1;
  padding: .2em;
  background-color: var(--mcmodder-color-background);
  border-radius: calc(var(--mcmodder-width-radius) * .5);
  font-size: 14px;
  box-shadow: 0px 2px 5px var(--mcmodder-color-background-dark2);
  opacity: 1;
  transition: opacity 0.2s ease-out 0s, transform 0.2s cubic-bezier(.18,.89,.32,1.28) 0s;
  outline: none;
}
.mcmodder-contextmenu.expand-right {
  transform: translateX(-1em);
}
.mcmodder-contextmenu.expand-left {
  transform: translateX(1em);
}
.mcmodder-contextmenu.faded {
  opacity: 0;
  transform: translateX(0em);
}
.mcmodder-contextmenu.hidden {
  display: none;
}
.mcmodder-contextmenu-inner {
  position: relative;
}
.mcmodder-contextmenu-inner .arrow::before {
  content: "";
  position: absolute;
  border: 0.5em solid transparent;
  width: 0;
  height: 0;
}
.mcmodder-contextmenu.expand-right .arrow::before {
  left: calc(-2 * var(--mcmodder-width-padding-3));
  top: .25em;
  border-right-color: var(--mcmodder-color-background);
}
.mcmodder-contextmenu.expand-left .arrow::before {
  right: calc(-2 * var(--mcmodder-width-padding-3));
  top: .25em;
  border-left-color: var(--mcmodder-color-background);
}
.mcmodder-contextmenu ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.mcmodder-contextmenu li {
  padding: .2em var(--mcmodder-width-padding-2);
  border-radius: calc(var(--mcmodder-width-radius) * .5);
  text-wrap: nowrap;
  cursor: var(--mcmodder-cursor-hand);
}
.mcmodder-contextmenu li.empty {
  color: var(--mcmodder-color-text-dark3);
  cursor: default;
}
.mcmodder-contextmenu li.selected:not(.empty) {
  background-color: var(--mcmodder-color-primary-transparent2);
}
.mcmodder-contextmenu li a {
  text-decoration: none;
  color: inherit;
}
.mcmodder-contextmenu .item-shortcut-left {
  float: right;
  opacity: .5;
  margin-left: .5em;
}
.mcmodder-contextmenu .item-shortcut-left kbd {
  background-color: var(--mcmodder-color-background-dark1);
  border: 1px solid var(--mcmodder-color-background-dark3);
  border-radius: 3px;
  padding: 0 .3em;
}
.mcmodder-contextmenu-icon {
  font-family: FontAwesome;
  font-style: normal;
  margin-right: .35em;
  color: var(--mcmodder-color-accent-dark1);
}
</style>
