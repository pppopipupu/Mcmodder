<template>
  <div class="mcmodder-settings-panel">
    <template v-for="entry in entries" :key="entry.key">
      <div class="center-setting-block">
        <div class="setting-item">
          <!-- 复选框 -->
          <div v-if="entry.data.type === McmodderInputType.CHECKBOX" class="checkbox">
            <input
              type="checkbox"
              :id="entry.inputId"
              :checked="!!getValue(entry.key)"
              @change="commitValue(entry.key, ($event.target as HTMLInputElement).checked)"
            >
            <label :for="entry.inputId">{{ entry.data.title }}</label>
          </div>

          <!-- 数字输入 -->
          <template v-else-if="entry.data.type === McmodderInputType.NUMBER">
            <span class="title">{{ entry.data.title }}:</span>
            <div class="mcmodder-numberinput-container">
              <input
                class="form-control"
                :placeholder="entry.data.title + '..'"
                :value="formatNumber(getValue(entry.key))"
                @change="commitNumber(entry, $event)"
              >
            </div>
          </template>

          <!-- 滑块 + 数字输入 -->
          <template v-else-if="entry.data.type === McmodderInputType.SLIDER">
            <span class="title">{{ entry.data.title }}:</span>
            <div class="mcmodder-numberinput-container">
              <input
                class="form-control"
                :placeholder="entry.data.title + '..'"
                :value="formatNumber(sliderLive[entry.key] ?? getValue(entry.key))"
                @change="commitNumber(entry, $event)"
              >
              <div class="mcmodder-slider-container" :ref="el => (sliderBars[entry.key] = el as HTMLElement)">
                <div
                  class="mcmodder-slider-bar"
                  @mousedown="onSliderBarMousedown(entry, $event)"
                  @mousemove="onSliderMousemove(entry, $event)"
                  @mouseup="onSliderMouseup(entry)"
                >
                  <div
                    class="mcmodder-slider-tap"
                    :class="{ focus: sliderDraggingKey === entry.key }"
                    :style="{ left: getSliderRate(entry) * 100 + '%' }"
                    @mousedown="onSliderTapMousedown(entry, $event)"
                  />
                </div>
              </div>
            </div>
          </template>

          <!-- 文本输入 -->
          <template v-else-if="entry.data.type === McmodderInputType.TEXT">
            <span class="title">{{ entry.data.title }}:</span>
            <input
              class="form-control"
              :value="getValue(entry.key)"
              @change="commitText(entry, $event)"
            >
          </template>

          <!-- 颜色选择 -->
          <template v-else-if="entry.data.type === McmodderInputType.COLORPICKER">
            <span class="title">{{ entry.data.title }}:</span>
            <input
              class="form-control mcmodder-colorpicker"
              type="color"
              :value="getValue(entry.key)"
              @change="commitValue(entry.key, ($event.target as HTMLInputElement).value)"
            >
          </template>

          <!-- 快捷键录制 -->
          <template v-else-if="entry.data.type === McmodderInputType.KEYBIND">
            <span class="title">{{ entry.data.title }}:</span>
            <input
              class="form-control mcmodder-keybind-input"
              :value="keybindDisplay(entry.key)"
              @focus="keybindOnFocus(entry.key)"
              @keydown="keybindOnKeydown(entry.key, $event)"
              @keyup="keybindOnKeyup(entry.key, $event)"
              @blur="keybindOnBlur(entry.key)"
            >
          </template>

          <!-- 下拉菜单 -->
          <template v-else-if="entry.data.type === McmodderInputType.DROPDOWN_MENU">
            <span class="title">{{ entry.data.title }}:</span>
            <select
              class="mcmodder-select"
              :value="getValue(entry.key)"
              @change="commitValue(entry.key, Number(($event.target as HTMLSelectElement).value))"
            >
              <option
                v-for="(label, num) in entry.data.range"
                :key="num"
                :value="num"
              >{{ label }}{{ Number(num) === entry.data.value ? " (默认)" : "" }}</option>
            </select>
          </template>

          <!-- 带推荐列表的文本输入 -->
          <template v-else-if="entry.data.type === McmodderInputType.DROPDOWN_TEXT_MENU">
            <span class="title">{{ entry.data.title }}:</span>
            <div class="mcmodder-input-container">
              <input
                class="form-control"
                :value="getValue(entry.key)"
                @focus="openSuggestions(entry)"
                @input="filterSuggestions(entry, $event)"
                @blur="closeSuggestions(entry)"
              >
              <div v-if="suggestionOpen[entry.key]" class="mcmodder-input-list">
                <a
                  v-for="(rec, i) in suggestionList[entry.key] || []"
                  :key="i"
                  href="javascript:void(0)"
                  @mousedown.prevent="commitSuggestion(entry, rec.value)"
                >
                  <span v-if="rec.html" v-html="rec.html" />
                  <span v-else>{{ rec.value }}{{ isDefaultRecommendation(entry, rec.value) ? " (默认)" : "" }}</span>
                </a>
                <span v-if="!(suggestionList[entry.key] || []).length" class="empty">没有匹配的推荐项...</span>
              </div>
            </div>
          </template>

          <!-- 立即检查更新（跟随 autoCheckUpdate 配置项） -->
          <template v-if="entry.key === 'autoCheckUpdate'">
            <button class="btn" id="mcmodder-update-check-manual" @click="checkUpdate">立即检查更新</button>
            <span :ref="el => (timerSlots.autoCheckUpdate = el as HTMLElement | null)" class="mcmodder-settings-timer-slot" />
          </template>

          <!-- Supabase 用户认证（跟随 useSupabase 配置项） -->
          <template v-if="entry.key === 'useSupabase' && !!getValue('useSupabase')">
            <button class="btn" id="mcmodder-auth-manual" :disabled="authing" @click="manualAuth">
              {{ authing ? "认证中..." : "立即认证" }}
            </button>
            <span>当前已绑定: </span>
            <span class="mcmodder-auth-user" :class="authUserClass">{{ authUserName }}</span>
            <span class="mcmodder-auth-state" :class="authStateClass">
              <i :class="authStateIcon" />
            </span>
          </template>
        </div>
        <p class="text-muted" v-html="entry.description" />

        <!-- 云端同步按钮组（跟随 useSupabase 配置项） -->
        <div v-if="entry.key === 'useSupabase' && !!getValue('useSupabase')" class="supabase-sync-block">
          <button class="btn" :disabled="syncing" @click="syncUpload">
            <i class="fa fa-cloud-upload" />
            保存所有配置数据至云端
          </button>
          <button class="btn" :disabled="syncing" @click="syncDownload">
            <i class="fa fa-cloud-download" />
            从云端同步所有配置数据
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { GM_getValue, GM_setValue } from "$";
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { Mcmodder } from "../../Mcmodder";
import { McmodderConfigUtils, McmodderInputType } from "../../config/ConfigUtils";
import type { InputSimplifiedRecommendation, InputValueNumericRange, McmodderConfigData, McmodderKeyData, SupabaseAuthenticatorResponse, SupabaseSyncSettingsResponse } from "../../types";
import { McmodderUtils } from "../../Utils";
import { McmodderTimer } from "../../widget/Timer";
import { useConfig } from "../composables/useConfig";

/**
 * 全局设置面板 —— Vue 3 重构版。
 *
 * 替代原 `CenterSettingInit` 中基于 `McmodderConfigInteractor` 手动拼接的
 * 配置表单，通过 `useConfig()` 响应式绑定 GM 存储，配置变更实时联动 UI。
 */

const props = defineProps<{
  parent: Mcmodder;
}>();

const parent = props.parent;
const utils = parent.utils;
const cfgutils = parent.cfgutils;

const { config, get, set } = useConfig("mcmodderSettings");

interface SettingsEntry {
  key: string;
  data: McmodderConfigData;
  inputId: string;
  description: string;
}

const permission = utils.getProfile("permission");

const entries = computed<SettingsEntry[]>(() => {
  const list: SettingsEntry[] = [];
  Object.keys(cfgutils.data).forEach(key => {
    const data = cfgutils.data[key];
    if (data.permission && permission < data.permission) return;
    if (data.type === McmodderInputType.KEYBIND && parent.isMobileClient) return;
    list.push({
      key,
      data,
      inputId: `settings-${ key }`,
      description: buildDescription(data)
    });
  });
  return list;
});

function getValue(key: string) {
  const value = get(key);
  if (value !== undefined) return value;
  return cfgutils.data[key]?.value ?? McmodderConfigUtils.defaultValue[cfgutils.data[key]?.type ?? McmodderInputType.CHECKBOX];
}

function commitValue(key: string, value: any) {
  set(key, value);
}

function formatNumber(value: any) {
  if (value === undefined || value === null || value === "") return "";
  const num = Number(value);
  return isNaN(num) ? "" : Number(num.toFixed(10));
}

function getRange(entry: SettingsEntry): InputValueNumericRange {
  const range = entry.data.range as InputValueNumericRange | undefined;
  return range || [null, null];
}

function commitNumber(entry: SettingsEntry, e: Event) {
  const input = e.target as HTMLInputElement;
  const newValue = Number(input.value);
  const current = getValue(entry.key);
  const [min, max] = getRange(entry);
  const showError = (msg: string) => {
    McmodderUtils.commonMsg(msg, false);
    input.value = formatNumber(current);
  };
  if (isNaN(newValue)) {
    showError("请输入一个正确的数值~");
    return;
  }
  if (newValue === Number(current)) return;
  if (min != null && newValue < min) {
    showError(`您输入的数值 (${ newValue.toLocaleString() }) 低于允许的最小值 (${ min.toLocaleString() })，请重新设置~`);
    return;
  }
  if (max != null && newValue > max) {
    showError(`您输入的数值 (${ newValue.toLocaleString() }) 高于允许的最大值 (${ max.toLocaleString() })，请重新设置~`);
    return;
  }
  commitValue(entry.key, newValue);
}

function commitText(entry: SettingsEntry, e: Event) {
  const input = e.target as HTMLInputElement;
  const newValue = input.value.trim();
  if (newValue === getValue(entry.key)) {
    input.value = getValue(entry.key);
    return;
  }
  commitValue(entry.key, newValue);
}

/* ---------------- 滑块 ---------------- */

const sliderBars = reactive<Record<string, HTMLElement | null>>({});
const sliderLive = reactive<Record<string, number>>({});
const sliderDraggingKey = ref<string | null>(null);
let sliderDragOffset = 0;

function getSliderRange(entry: SettingsEntry): [number, number] {
  const [min, max] = getRange(entry);
  return [min ?? 0, max ?? 1];
}

function getSliderRate(entry: SettingsEntry) {
  const [min, max] = getRange(entry);
  if (min == null || max == null || max <= min) return 0;
  const value = sliderLive[entry.key] ?? getValue(entry.key);
  return McmodderUtils.clamp((Number(value) - min) / (max - min));
}

function onSliderTapMousedown(entry: SettingsEntry, e: MouseEvent) {
  const bar = sliderBars[entry.key];
  if (!bar) return;
  sliderDraggingKey.value = entry.key;
  const tap = e.currentTarget as HTMLElement;
  const tapCenter = tap.getBoundingClientRect().left - bar.getBoundingClientRect().left + tap.getBoundingClientRect().width / 2;
  sliderDragOffset = e.screenX - tapCenter - bar.getBoundingClientRect().left;
  e.stopPropagation();
  e.preventDefault();
}

function onSliderBarMousedown(entry: SettingsEntry, e: MouseEvent) {
  sliderDraggingKey.value = entry.key;
  sliderDragOffset = 0;
  e.preventDefault();
  updateSliderFromMouse(entry, e);
}

function onSliderMousemove(entry: SettingsEntry, e: MouseEvent) {
  if (sliderDraggingKey.value !== entry.key) return;
  updateSliderFromMouse(entry, e);
}

function onSliderMouseup(entry: SettingsEntry) {
  if (sliderDraggingKey.value !== entry.key) return;
  sliderDraggingKey.value = null;
  const value = sliderLive[entry.key];
  if (value !== undefined && value !== Number(getValue(entry.key))) {
    commitValue(entry.key, value);
  }
}

function updateSliderFromMouse(entry: SettingsEntry, e: MouseEvent) {
  const bar = sliderBars[entry.key];
  if (!bar) return;
  const [min, max] = getSliderRange(entry);
  const barLeft = bar.getBoundingClientRect().left;
  const barWidth = bar.getBoundingClientRect().width;
  const dragPos = e.screenX + sliderDragOffset - barLeft;
  const rate = McmodderUtils.clamp(dragPos / barWidth);
  const precision = max - min === 1 ? 0.01 : 1;
  const rawValue = min + (max - min) * rate;
  const value = Math.round(rawValue / precision) * precision;
  sliderLive[entry.key] = value;
}

/* ---------------- 快捷键录制 ---------------- */

interface KeybindState {
  lastData?: McmodderKeyData;
  queue: number;
  finished: boolean;
}

const keybindStates = reactive<Record<string, KeybindState>>({});

function getKeybindState(key: string): KeybindState {
  if (!keybindStates[key]) {
    keybindStates[key] = { queue: 0, finished: false };
  }
  return keybindStates[key];
}

function keybindDisplay(key: string) {
  return McmodderUtils.keyToString(getValue(key) || {});
}

function keybindOnFocus(key: string) {
  const state = getKeybindState(key);
  state.lastData = undefined;
  state.queue = 0;
  state.finished = false;
}

function keybindOnKeydown(key: string, e: KeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();
  const state = getKeybindState(key);
  if (e.key === state.lastData?.key) return;
  if (e.key === "Escape") {
    state.lastData = undefined;
    state.queue = 0;
    state.finished = false;
    (e.target as HTMLInputElement).blur();
    return;
  }
  state.lastData = e as unknown as McmodderKeyData;
  state.queue++;
  (e.target as HTMLInputElement).value = McmodderUtils.keyToString(e as unknown as McmodderKeyData);
  if (e.metaKey && !["Control", "Alt", "Meta", "Shift"].includes(e.key)) {
    keybindOnKeyup(key, e);
  }
}

function keybindOnKeyup(key: string, e: KeyboardEvent) {
  e.preventDefault();
  const state = getKeybindState(key);
  if (--state.queue) return;
  const r = state.lastData;
  if (!r) return;
  const d: McmodderKeyData = {};
  if (r.ctrlKey) d.ctrlKey = true;
  if (r.shiftKey) d.shiftKey = true;
  if (r.altKey) d.altKey = true;
  if (r.metaKey) d.metaKey = true;
  d.key = r.key;
  if (r.keyCode && r.keyCode >= 97 && r.keyCode <= 122) r.keyCode -= 32;
  d.keyCode = r.keyCode;
  state.finished = true;
  commitValue(key, d);
  (e.target as HTMLInputElement).blur();
}

function keybindOnBlur(key: string) {
  const state = getKeybindState(key);
  if (state.finished) return;
  commitValue(key, {});
}

/* ---------------- 推荐列表 ---------------- */

const suggestionOpen = reactive<Record<string, boolean>>({});
const suggestionList = reactive<Record<string, InputSimplifiedRecommendation[]>>({});

function normalizeRecommendation(rec: InputSimplifiedRecommendation): { html?: string; value: string } {
  if (typeof rec === "string") return { value: rec };
  return { html: rec.html, value: rec.value };
}

function isDefaultRecommendation(entry: SettingsEntry, value: string) {
  return entry.data.value === value;
}

function openSuggestions(entry: SettingsEntry) {
  suggestionOpen[entry.key] = true;
  filterSuggestions(entry, { target: { value: getValue(entry.key) } } as unknown as Event);
}

function filterSuggestions(entry: SettingsEntry, e: Event) {
  const text = String((e.target as HTMLInputElement).value || "").trim().toLowerCase();
  const list = (entry.data.recommendation || []).filter(rec => {
    const { value } = normalizeRecommendation(rec);
    return !text || value.toLowerCase().includes(text);
  });
  suggestionList[entry.key] = list;
}

function closeSuggestions(entry: SettingsEntry) {
  window.setTimeout(() => {
    suggestionOpen[entry.key] = false;
  }, 150);
}

function commitSuggestion(entry: SettingsEntry, value: string) {
  suggestionOpen[entry.key] = false;
  commitValue(entry.key, value);
}

/* ---------------- 更新检查 ---------------- */

const timerSlots = reactive<Record<string, HTMLElement | null>>({});
let updateTimer: McmodderTimer | undefined;

function checkUpdate() {
  parent.scheduleRequestUtils.run("autoCheckUpdate");
}

function refreshUpdateTimer() {
  if (!timerSlots.autoCheckUpdate) return;
  timerSlots.autoCheckUpdate.innerHTML = "";
  if (getValue("autoCheckUpdate")) {
    updateTimer = new McmodderTimer(
      parent,
      McmodderTimer.DATAGETTER_SCHEDULE("autoCheckUpdate", null, parent.scheduleRequestUtils)
    );
    updateTimer.$instance.appendTo(timerSlots.autoCheckUpdate);
  }
}

/* ---------------- Supabase 认证与同步 ---------------- */

const authing = ref(false);
const syncing = ref(false);

const authState = reactive({
  uid: 0,
  name: "",
  key: ""
});

function refreshAuthState() {
  authState.uid = utils.getProfile("auth_uid");
  authState.name = utils.getProfile("auth_username");
  authState.key = utils.getProfile("auth_key");
}

const authUserClass = computed(() => (!authState.uid || !authState.name ? "text-muted" : "text-success"));
const authUserName = computed(() => (!authState.uid || !authState.name ? "?" : `${ authState.name } (UID:${ authState.uid })`));
const authStateClass = computed(() => {
  if (!authState.uid || !authState.name) return "text-danger";
  return authState.key ? "text-success" : "text-danger";
});
const authStateIcon = computed(() => (authStateClass.value === "text-success" ? "fa fa-check" : "fa fa-close"));

async function manualAuth() {
  authing.value = true;
  try {
    if (!parent.supabaseUtils.hasClient()) return;
    const resp = await parent.supabaseUtils.invoke<SupabaseAuthenticatorResponse>("authenticator", {
      body: { cookie: document.cookie }
    });
    if (!resp) return;
    utils.setProfile("auth_uid", resp.user_id);
    utils.setProfile("auth_username", resp.user_name);
    utils.setProfile("auth_key", resp.auth_key);
    refreshAuthState();
  } finally {
    authing.value = false;
  }
}

async function syncUpload() {
  const { value } = await swal.fire({
    type: "warning",
    title: "配置上传确认",
    text: `即将把本地的所有脚本配置数据保存在云端（包括脚本设置、已保存的用户信息和模板列表），便于同步到其他终端设备上。
      云端若已保存配置则会被覆盖，无法撤销。是否继续？`,
    showCancelButton: true,
    confirmButtonText: "确认",
    cancelButtonText: "取消"
  });
  if (!value) return;
  syncing.value = true;
  try {
    const resp = await parent.supabaseUtils.invoke<SupabaseSyncSettingsResponse>("sync_settings", {
      body: {
        auth_key: utils.getProfile("auth_key"),
        content: {
          mcmodder_settings: GM_getValue("mcmodderSettings"),
          user_profile: GM_getValue("userProfile"),
          template_list: GM_getValue("templateList"),
        }
      }
    });
    if (resp) {
      McmodderUtils.commonMsg("已将本地配置保存至云端~");
    }
  } finally {
    syncing.value = false;
  }
}

async function syncDownload() {
  const { value } = await swal.fire({
    type: "warning",
    title: "配置下载确认",
    text: `即将把云端所有已保存的脚本配置数据同步到本地（包括脚本设置、已保存的用户信息和模板列表）。
      本地配置将会与云端配置合并（模板则是全部覆盖），无法撤销。是否继续？`,
    showCancelButton: true,
    confirmButtonText: "确认",
    cancelButtonText: "取消"
  });
  if (!value) return;
  syncing.value = true;
  try {
    const resp = await parent.supabaseUtils.invoke<SupabaseSyncSettingsResponse>("sync_settings", {
      body: {
        auth_key: utils.getProfile("auth_key")
      }
    });
    if (resp) {
      let success = 0;
      if (resp.mcmodder_settings) {
        try {
          const obj1 = JSON.parse(GM_getValue("mcmodderSettings") || "{}");
          const obj2 = JSON.parse(resp.mcmodder_settings);
          GM_setValue("mcmodderSettings", JSON.stringify(Object.assign({}, obj1, obj2)));
          success++;
        } catch (e) {
          McmodderUtils.commonMsg(String(e), false);
        }
      }
      if (resp.user_profile) {
        try {
          const obj1 = JSON.parse(GM_getValue("userProfile") || "{}");
          const obj2 = JSON.parse(resp.user_profile);
          GM_setValue("userProfile", JSON.stringify(Object.assign({}, obj1, obj2)));
          success++;
        } catch (e) {
          McmodderUtils.commonMsg(String(e), false);
        }
      }
      if (resp.template_list) {
        GM_setValue("templateList", resp.template_list);
        success++;
      }
      if (success > 0) {
        const interval = Date.now() - Date.parse(resp.last_modified);
        const formatted = McmodderUtils.getFormattedTime(interval);
        McmodderUtils.commonMsg(`已将 ${ formatted } 前保存在云端的 ${ success } 项配置同步到本地，刷新标签页以查看同步后的配置~`);
      } else {
        McmodderUtils.commonMsg("本地配置未发生变化...");
      }
    }
  } finally {
    syncing.value = false;
  }
}

/* ---------------- 描述文本 ---------------- */

function buildDescription(data: McmodderConfigData) {
  if (data.type === McmodderInputType.DROPDOWN_MENU) return data.description;
  const list: string[] = [];
  const val = data.value;
  if (val != null) {
    list.push(`默认：${
      typeof val === "boolean" ? (val ? "开启" : "关闭") :
      typeof val === "number" ? val.toLocaleString() :
      typeof val === "object" ? McmodderUtils.keyToString(val) : val
    }`);
  }
  const range = (data.range || [null, null]) as InputValueNumericRange;
  const l = range[0], r = range[1];
  const tl = l?.toLocaleString(), tr = r?.toLocaleString();
  if (l != null && r != null) list.push(`允许范围：${ tl } ~ ${ tr }`);
  else if (l != null) list.push(`最小值：${ tl }`);
  else if (r != null) list.push(`最大值：${ tr }`);
  const appendix = list.length ? `（${ list.join("；") }）` : "";
  return `${ data.description }${ appendix }`;
}

/* ---------------- 生命周期 ---------------- */

onMounted(() => {
  refreshAuthState();
  refreshUpdateTimer();
});

watch(
  () => getValue("autoCheckUpdate"),
  () => refreshUpdateTimer()
);
</script>

<style scoped>
.mcmodder-settings-panel {
  font-size: 14px;
  color: var(--mcmodder-color-text);
}
.center-setting-block {
  padding: .6em 0;
  border-bottom: 1px solid var(--mcmodder-color-background-dark2);
}
.center-setting-block:last-child {
  border-bottom: none;
}
.setting-item {
  display: flex;
  align-items: center;
  gap: .5em;
  flex-wrap: wrap;
  line-height: 1.8;
}
.setting-item > .title {
  font-weight: bold;
  white-space: nowrap;
}
.setting-item .form-control {
  display: inline-block;
  width: 240px;
  max-width: 100%;
  padding: .2em .5em;
  background-color: var(--mcmodder-color-background);
  border: 1px solid var(--mcmodder-color-background-dark3);
  border-radius: var(--mcmodder-width-radius);
  color: var(--mcmodder-color-text);
  font-size: 14px;
}
.setting-item .form-control:focus {
  border-color: var(--mcmodder-color-accent);
  box-shadow: 0 0 0 .2em var(--mcmodder-color-accent-transparent2);
  outline: none;
}
.setting-item .form-control.mcmodder-colorpicker {
  width: 4em;
  height: 2em;
  padding: 2px;
}
.setting-item .btn {
  padding: .25em .8em;
  background: linear-gradient(45deg, var(--mcmodder-color-primary-light), var(--mcmodder-color-accent-light));
  color: var(--mcmodder-color-text);
  border: 1px solid var(--mcmodder-color-background-dark3);
  border-radius: var(--mcmodder-width-radius);
  cursor: var(--mcmodder-cursor-hand);
  margin: 0 var(--mcmodder-width-padding-3);
}
.setting-item .btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.text-muted {
  color: var(--mcmodder-color-text-dark3);
  font-size: 12.5px;
  margin: .25em 0 0 0;
  line-height: 1.6;
}
/* 复选框 */
.checkbox {
  position: relative;
  display: inline-block;
  cursor: var(--mcmodder-cursor-hand);
}
.checkbox input[type="checkbox"] {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}
.checkbox label {
  display: inline-block;
  position: relative;
  padding-left: 1.6em;
  margin-bottom: 0;
  cursor: var(--mcmodder-cursor-hand);
  line-height: 1.8;
}
.checkbox label::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 1.2em;
  height: 1.2em;
  background-color: var(--mcmodder-color-background);
  border: 1px solid var(--mcmodder-color-background-dark3);
  border-radius: 3px;
}
.checkbox input[type="checkbox"]:checked + label::before {
  background-color: var(--mcmodder-color-primary);
  border-color: var(--mcmodder-color-primary-dark1);
}
.checkbox input[type="checkbox"]:checked + label::after {
  content: "\f00c";
  font-family: FontAwesome;
  position: absolute;
  left: .15em;
  top: 50%;
  transform: translateY(-50%);
  color: #fff;
  font-size: .9em;
}
/* 数字输入 */
.mcmodder-numberinput-container {
  display: inline-block;
}
.mcmodder-numberinput-container .form-control {
  width: 180px;
}
/* 滑块 */
.mcmodder-slider-container {
  display: inline-block;
  width: 250px;
  vertical-align: middle;
}
.mcmodder-slider-bar {
  position: relative;
  margin: 0 1em;
  height: 6px;
  background-color: var(--mcmodder-color-primary-light);
  border-radius: 3px;
  cursor: pointer;
}
.mcmodder-slider-tap {
  position: absolute;
  top: -5px;
  height: 16px;
  width: 16px;
  background-color: var(--mcmodder-color-primary);
  border: 1px solid var(--mcmodder-color-background-dark3);
  border-radius: 50%;
  transform: translateX(-50%);
  cursor: var(--mcmodder-cursor-hand);
}
.mcmodder-slider-tap:hover,
.mcmodder-slider-tap.focus {
  border-color: var(--mcmodder-color-accent);
  box-shadow: 0 0 0 .2em var(--mcmodder-color-accent-transparent2);
}
/* 快捷键 */
.mcmodder-keybind-input {
  width: 240px;
  text-align: center;
  cursor: text;
}
/* 下拉菜单 */
.mcmodder-select {
  display: inline-block;
  padding: .2em .5em;
  background-color: var(--mcmodder-color-background);
  border: 1px solid var(--mcmodder-color-background-dark3);
  border-radius: var(--mcmodder-width-radius);
  color: var(--mcmodder-color-text);
  font-size: 14px;
}
/* 推荐列表 */
.mcmodder-input-container {
  position: relative;
  display: inline-block;
}
.mcmodder-input-list {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  min-width: 100%;
  max-width: 480px;
  max-height: 300px;
  overflow: auto;
  background-color: var(--mcmodder-color-background);
  border: 1px solid var(--mcmodder-color-background-dark3);
  border-radius: var(--mcmodder-width-radius);
  box-shadow: 0px 2px 5px var(--mcmodder-color-background-dark2);
}
.mcmodder-input-list a {
  display: block;
  padding: .3em .6em;
  color: var(--mcmodder-color-text);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mcmodder-input-list a:hover {
  background-color: var(--mcmodder-color-primary-transparent1);
}
.mcmodder-input-list .empty {
  display: block;
  padding: .3em .6em;
  color: var(--mcmodder-color-text-dark3);
}
/* 认证与同步 */
.mcmodder-auth-user {
  margin-left: .25em;
}
.mcmodder-auth-state {
  margin-left: var(--mcmodder-width-padding-3);
}
.text-success {
  color: var(--mcmodder-color-primary-dark1);
}
.text-danger {
  color: var(--mcmodder-color-danger);
}
.text-muted {
  color: var(--mcmodder-color-text-dark3);
}
.supabase-sync-block {
  margin-top: .5em;
}
.supabase-sync-block .btn {
  margin: 0 var(--mcmodder-width-padding-3) 0 0;
}
.mcmodder-settings-timer-slot {
  display: inline-block;
  margin-left: .5em;
}
</style>
