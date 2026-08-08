import { createApp, type App, type Component, type Ref } from "vue";

/**
 * Shadow DOM 容器挂载/卸载通用工具。
 *
 * 所有 Vue 3 组件都应通过本工具挂载到独立的 Shadow Root 中，
 * 以隔离宿主页面（MC百科主站 / Discuz 论坛）的全局 CSS 污染。
 *
 * 注意：样式上的 CSS 自定义属性（如 `--mcmodder-color-primary`）会从宿主
 * 页面继承到 Shadow Root 内，因此组件内仍可直接使用主题变量。
 */

export interface MountedVueApp {
  /** Vue 应用实例 */
  app: App;
  /** 影子宿主元素（位于宿主页面 DOM 中） */
  host: HTMLElement;
  /** Shadow Root */
  root: ShadowRoot;
  /** 卸载应用并移除宿主元素 */
  unmount: () => void;
}

/** 每个实例使用的宿主 id 前缀 */
const HOST_ID_PREFIX = "mcmodder-vue-host";

let hostCount = 0;

const BASE_RESET_STYLE = `
:host {
  display: block;
}
* {
  box-sizing: border-box;
}
`;

/**
 * 在目标容器内创建一个 Shadow DOM 容器并挂载 Vue 应用。
 *
 * @param Component Vue 组件
 * @param props 传给组件的 props
 * @param target 目标容器（HTMLElement 或选择器）；缺省为 document.body
 * @param options.shadow 是否使用 Shadow DOM 隔离，默认 true
 */
export function mountVueApp<Props extends Record<string, any> = Record<string, any>>(
  Component: Component<Props>,
  props?: Props,
  target?: HTMLElement | string,
  options: { shadow?: boolean } = {}
): MountedVueApp {
  const container = typeof target === "string" ? document.querySelector(target) : (target || document.body);
  if (!container) {
    throw new Error(`mountVueApp: 目标容器不存在 (${ String(target) })`);
  }

  const host = document.createElement("div");
  host.id = `${HOST_ID_PREFIX}-${ ++hostCount }`;

  let root: ShadowRoot | null = null;
  if (options.shadow !== false) {
    root = host.attachShadow({ mode: "open" });
  }

  container.appendChild(host);

  const app = createApp(Component, (props || {}) as Props);

  // 注入基础样式隔离标签：重置宿主页面继承的样式，并让主题变量透传
  const style = document.createElement("style");
  style.textContent = BASE_RESET_STYLE;
  (root || host).appendChild(style);

  app.mount((root || host) as unknown as Element);

  return {
    app,
    host,
    root: root || (host as unknown as ShadowRoot),
    unmount() {
      app.unmount();
      host.remove();
    }
  };
}

/**
 * 便捷工具：将一个元素挂载进 Shadow Root 内的指定容器（供 jQuery 组件在 Vue
 * 组件内部复用，例如把原有的 McmodderTimer / 日志组件追加进 Vue 渲染的容器）。
 */
export function appendToShadow(shadowHost: Element | ShadowRoot | null, node: Element) {
  const root = shadowHost instanceof ShadowRoot ? shadowHost : (shadowHost as HTMLElement | null)?.shadowRoot;
  (root || shadowHost || document.body).appendChild(node);
  return node;
}

/**
 * 将普通 Ref<HTMLElement | null> 转换为可被 Vue 模板 ref 使用的回调 ref。
 */
export function toTemplateRef(el: Ref<HTMLElement | null>) {
  return (node: Element | null) => {
    (el as Ref<HTMLElement | null>).value = node as HTMLElement | null;
  };
}
