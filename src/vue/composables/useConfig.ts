import { reactive, watch } from "vue";
import { GM_addValueChangeListener, GM_getValue, GM_setValue } from "$";

/**
 * 将油猴沙盒持久化 API（GM_getValue / GM_setValue）包装为 Vue 响应式状态。
 *
 * - 组件内直接读写返回的 reactive 对象即可，所有修改会自动写回 GM 存储；
 * - 通过 GM_addValueChangeListener 保持多标签页（以及页面原生代码
 *   McmodderUtils.setConfig 等）之间的响应式同步。
 */

export type SettingsObject = Record<string, any>;

function parseSettings(raw?: string): SettingsObject {
  if (raw === undefined || raw === null || raw === "") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.error("useConfig: 配置解析失败", e);
    return {};
  }
}

export function useConfig(storageKey = "mcmodderSettings") {
  const config = reactive<SettingsObject>(parseSettings(GM_getValue(storageKey)));

  /** 最近一次写入的 JSON 快照，用于跳过自身写回造成的监听回环 */
  let lastWritten = "";
  /** 最近一次从远端（本标签页监听）应用后的 JSON 快照 */
  let lastApplied = "";

  watch(
    config,
    () => {
      const json = JSON.stringify(config);
      // 若与最近一次远端应用结果一致，说明这是监听回环产生的写回，跳过
      if (json === lastApplied) return;
      if (json === lastWritten) return;
      lastWritten = json;
      GM_setValue(storageKey, json);
    },
    { deep: true }
  );

  GM_addValueChangeListener(storageKey, (_key: string, _oldValue?: string, newValue?: string) => {
    const remote = parseSettings(newValue);
    const currentJson = JSON.stringify(config);
    const remoteJson = JSON.stringify(remote);
    if (remoteJson === currentJson) return;

    // 应用远端配置：删除本地多余键，更新其余键
    for (const key of Object.keys(config)) {
      if (!(key in remote)) {
        delete config[key];
      }
    }
    Object.assign(config, remote);
    lastApplied = JSON.stringify(config);
  });

  /** 读取配置项，不存在时返回 defaultValue */
  function get(key: string, defaultValue: any = undefined) {
    const entry = config[key];
    return entry === undefined ? defaultValue : entry;
  }

  /** 写入配置项；value 为 null 时删除该键 */
  function set(key: string, value: any) {
    if (value === null || value === undefined) {
      delete config[key];
    } else {
      config[key] = value;
    }
  }

  return { config, get, set };
}
