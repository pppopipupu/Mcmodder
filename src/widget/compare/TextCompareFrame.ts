import { diffChars, diffWords, diffLines } from "diff";
import { TextCompareMode } from "../../types";
import { McmodderValues } from "../../Values";

const JsDiff: Record<TextCompareMode, any> = { diffChars, diffWords, diffLines };

export class TextCompareFrame {
  private insertPos: Element | JQuery;
  instance: JQuery;
  private readonly statsNode: JQuery;
  private readonly delCounter: JQuery;
  private readonly insCounter: JQuery;
  private readonly optContainer: JQuery;
  private readonly resultFrame: JQuery;
  private readonly textA: string;
  private readonly textB: string;
  isReady?: boolean;
  private del_num = 0;
  private ins_num = 0;
  private del_byte = 0;
  private ins_byte = 0;
  private currentPos = 0;
  private maxPos = 0;
  private compareResults = $();

  constructor(insertPos: Element | JQuery, textA: JQuery | string, textB: JQuery | string) {
    this.insertPos = insertPos;
    this.instance = $('<div id="mcmodder-text-area">').insertBefore(this.insertPos);
    this.statsNode = $('<div class="mcmodder-text-stats">').appendTo(this.instance);
    this.delCounter = $('<span class="stats-del">').hide().appendTo(this.statsNode);
    this.insCounter = $('<span class="stats-ins">').hide().appendTo(this.statsNode);
    this.optContainer = $('<span class="stats-opt">').hide().appendTo(this.statsNode);
    this.resultFrame = $('<pre id="mcmodder-text-result">').appendTo(this.instance);

    this.textA = (textA instanceof Object) ? this.getRawContent(textA as JQuery) : textA;
    this.textB = (textB instanceof Object) ? this.getRawContent(textB as JQuery) : textB;
  }

  getRawContent(l: JQuery) {
    let s = "";
    l.contents().filter((_, c) =>
      !/^[\s\n]*$/.test(c.textContent) &&
      c.tagName != "SCRIPT" &&
      c.className != "common-text-menu" &&
      c.className != "common-tag-ban"
    ).each((_, e) => {
      s += (e.textContent + "\n")
    });
    return s;
  }

  getDefaultMode(len1: number, len2: number): TextCompareMode {
    if (len1 + len2 > 5e4) return "diffLines";
    if (len1 + len2 > 1.5e4) return "diffWords";
    return "diffChars";
  }

  static modeName: Record<TextCompareMode, string> = {
    "diffLines": "按行对比",
    "diffWords": "按词对比",
    "diffChars": "按字对比"
  }

  performCompare() {

    this.resultFrame.html(`<img src="${McmodderValues.assets.mcmod.loading}"></img>`);

    let mode = this.getDefaultMode(this.textA.length, this.textB.length);
    let diff = JsDiff[mode](this.textA, this.textB); // 避免正文对比耗费过长的时间
    this.del_num = this.ins_num = this.del_byte = this.ins_byte = 0;

    let fragment = document.createDocumentFragment();
    for (let _i in diff) {
      const i = Number(_i);
      if (diff[i].added && diff[i + 1] && diff[i + 1].removed) {
        let swap = diff[i];
        diff[i] = diff[i + 1];
        diff[i + 1] = swap;
      }

      let node;
      if (diff[i].removed) {
        node = document.createElement('del');
        node.appendChild(document.createTextNode(diff[i].value));
        this.del_num++; this.del_byte += (new TextEncoder()).encode(node.textContent).length;
      } else if (diff[i].added) {
        node = document.createElement('ins');
        node.appendChild(document.createTextNode(diff[i].value));
        this.ins_num++; this.ins_byte += (new TextEncoder()).encode(node.textContent).length;
      } else {
        node = document.createTextNode(diff[i].value);
      }
      fragment.appendChild(node);
    }

    this.resultFrame.empty().text("");
    if (this.del_num || this.ins_num) this.resultFrame.get(0).appendChild(fragment);
    else {
      this.instance.hide();
      return;
    }

    if (this.del_num) this.delCounter.html(
      `<span class="mcmodder-slim-danger">删除: <strong>${
        this.del_num.toLocaleString()
      }</strong> 处 (<strong>${
        this.del_byte.toLocaleString()
      }</strong> 字节)</span>`
    ).show();

    if (this.ins_num) this.insCounter.html(`
      <span class="mcmodder-slim-dark">新增: <strong>${
        this.ins_num.toLocaleString()
      }</strong> 处 (<strong>${
        this.ins_byte.toLocaleString()
      }</strong> 字节)</span>`
    ).show();

    this.maxPos = this.ins_num + this.del_num;
    if (this.maxPos >= 1) {
      this.compareResults = this.resultFrame.find("del, ins");
      this.currentPos = 0;
      this.optContainer.html(`
        <span class="stats-opt-nav"></span>
        <a class="prev">↑</a>
        <a class="next">↓</a>
      `).show();
      this.updateOptNav(false);
      this.optContainer
      .on("click", ".prev", () => {
        this.currentPos--;
        if (this.currentPos < 0) {
          this.currentPos = this.maxPos - 1;
        }
        this.updateOptNav();
      })
      .on("click", ".next", () => {
        this.currentPos++;
        if (this.currentPos >= this.maxPos) {
          this.currentPos = 0;
        }
        this.updateOptNav();
      })
    }

    if (mode != "diffChars") $(
      `<span class="mcmodder-jsdiff-nodiffbytes">*正文过长，将${
        TextCompareFrame.modeName[mode]
      }而非${
        TextCompareFrame.modeName["diffChars"]
      }，以节省性能~</span>`
    ).appendTo(this.statsNode);
  }

  private updateOptNav(shouldSelect = true) {
    this.optContainer.find(".stats-opt-nav").html(`${
      (this.currentPos + 1).toLocaleString()
    } / ${
      this.maxPos.toLocaleString()
    }`);

    const container = this.resultFrame.get(0);
    const node = this.compareResults[this.currentPos];

    if (shouldSelect) {
      const range = this.instance.get(0).ownerDocument.createRange();
      range.setStart(node, 0);
      range.setEnd(node, 1);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    const innerRect = node.getBoundingClientRect();
    const outerRect = container.getBoundingClientRect();
    let x = innerRect.x - outerRect.x;
    let y = innerRect.y - outerRect.y;
    x -= outerRect.width / 2;
    y -= outerRect.height / 2;
    x += innerRect.width / 2;
    y += innerRect.height / 2;
    container.scrollBy(x, y);
  }
}