import { InputRatedRecommendation, InputRecommendation, InputSimplifiedRecommendation } from "../types";
import { McmodderUtils } from "../Utils";

type InputListOnInitRecommendation = () => InputSimplifiedRecommendation[];
type InputListOnModifyRecommendation = (list: InputRecommendation[]) => boolean;

export class InputList {
  private readonly container: JQuery;
  private readonly inputNode: JQuery;
  private readonly inputList: JQuery;
  private readonly input: HTMLInputElement;
  private recommendationList: InputRecommendation[] = [];
  private selected = 0;
  private listLength = 0;
  private readonly onInitRecommendation: InputListOnInitRecommendation;
  private readonly onModifyRecommendation?: InputListOnModifyRecommendation;
  private readonly delimiter?: string;
  private readonly hideBeforeInput: boolean;

  private static readonly intlCollator = new Intl.Collator("zh");
  static readonly loadRecommendationFromConfig = (utils: McmodderUtils, key: string, item: string = "inputList") => () => {
    return utils.getConfig(key, item) ?? [];
  };
  static readonly saveRecommendationToConfig = (utils: McmodderUtils, key: string, item: string = "inputList") => (list: InputRecommendation[]) => {
    const simplified = list.map(e => typeof e === "string" ? e : e.value);
    utils.setConfig(key, simplified, item);
    return true;
  }

  constructor(inputNode: JQuery, onInitRecommendation: InputListOnInitRecommendation, onModifyRecommendation?: InputListOnModifyRecommendation, delimiter?: string, hideBeforeInput?: boolean);
  constructor(inputNode: JQuery, utils: McmodderUtils, configKey: string, delimiter?: string, hideBeforeInput?: boolean);
  constructor(...args: [inputNode: JQuery, onInitRecommendation: InputListOnInitRecommendation, onModifyRecommendation?: InputListOnModifyRecommendation, delimiter?: string, hideBeforeInput?: boolean] |
                       [inputNode: JQuery, utils: McmodderUtils, configKey: string, delimiter?: string, hideBeforeInput?: boolean]
  ) {
    const inputNode = args[0];
    const onInitRecommendation = typeof args[2] === "string" ? InputList.loadRecommendationFromConfig(args[1] as McmodderUtils, args[2]) : args[1] as InputListOnInitRecommendation;
    const onModifyRecommendation = typeof args[2] === "string" ? InputList.saveRecommendationToConfig(args[1] as McmodderUtils, args[2]) : args[2] as InputListOnModifyRecommendation;
    const delimiter = args[3];
    const hideBeforeInput = args[4];

    if (inputNode.length != 1) {
      throw new Error("参数须有且仅有一个元素。");
    }
    this.input = inputNode.get(0) as HTMLInputElement;
    if (this.input.tagName != "INPUT") {
      throw new Error("元素必须是 HTMLInputElement。");
    }

    this.inputNode = inputNode;
    this.container = $(`<div class="mcmodder-input-container">`).insertBefore(this.inputNode);
    this.inputNode.appendTo(this.container);
    this.inputList = $(`<div class="mcmodder-input-list">`).hide().appendTo(this.container);
    this.onInitRecommendation = onInitRecommendation;
    this.onModifyRecommendation = onModifyRecommendation;
    this.delimiter = delimiter;
    this.hideBeforeInput = hideBeforeInput ?? false;

    this.inputNode.focus(_e => {
      this.recommendationList = this.onInitRecommendation()
      .map(e => {
        if (typeof e === "string") {
          e = { value: e };
        }
        return e;
      });
      this.updateRecommendableList(this.getSelectionValue());
    })
    .keydown(e => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
      }
    })
    .keyup(e => {
      if (e.key === "ArrowUp") {
        let selected = this.selected - 1;
        if (selected < 0) selected = this.listLength - 1;
        this.updateSelection(selected);
      }
      else if (e.key === "ArrowDown") {
        let selected = this.selected + 1;
        if (selected >= this.listLength) selected = 0;
        this.updateSelection(selected);
      }
      else if (e.key === "Tab" || e.key === "Enter") {
        const node = this.getSelectedOptionNode();
        if (node) {
          e.preventDefault();
          node.click();
        }
      }
      else {
        this.updateRecommendableList(this.getSelectionValue());
      }
    })
    .blur(_e => {
      setTimeout(() => this.inputList.hide().empty(), 100);
    });

    this.inputList
    .on("click", "a.mcmodder-input-option", e => {
      const target = e.currentTarget;

      if (target.classList.contains("mcmodder-input-new")) {
        const value = this.getSelectionValue();
        if (!value) {
          return;
        }
        if (this.recommendationList.filter(e => e.value === value).length) {
          McmodderUtils.commonMsg("当前输入的内容已经存在于候选列表~", false);
          return;
        }
        this.recommendationList.push({ value });
        this.recommendationList.sort((a, b) => InputList.intlCollator.compare(a.value, b.value));
        if (this.onModifyRecommendation!(this.recommendationList)) {
          McmodderUtils.commonMsg("已将当前输入的内容保存于候选列表~");
        } else {
          McmodderUtils.commonMsg("保存失败...", false);
        }
        return;
      }

      const val = target.getAttribute("data-value");
      if (val === null) {
        console.warn("候选按钮无对应值。");
        return;
      }
      this.setSelectionValue(val, !!this.delimiter);
    })
    .on("click", "a.mcmodder-input-delete", e => {
      const target = e.currentTarget;
      const val = target.parentElement!.getAttribute("data-value");
      this.recommendationList = this.recommendationList.filter(e => e.value != val);
      if (this.onModifyRecommendation!(this.recommendationList)) {
        McmodderUtils.commonMsg("成功从候选列表中移除选中项~");
      } else {
        McmodderUtils.commonMsg("移除失败...", false);
      }
      e.stopPropagation();
    })
    .on("mouseenter", "a.mcmodder-input-option", e => {
      const target = e.currentTarget;
      target.classList.add("selected");
    })
    .on("mouseleave", "a.mcmodder-input-option", e => {
      const target = e.currentTarget;
      if (Number(target.getAttribute("data-index")) != this.selected) {
        target.classList.remove("selected");
      }
    });
  }

  private getSectionIndex(vals: string[], pos: number, delimiter: string) {
    for (let i = 0, j = 0; i < vals.length; j += vals[i++].length + delimiter.length) {
      if (pos >= j && pos < j + vals[i].length + delimiter.length) {
        return i;
      }
    }
    return -1;
  }

  private getSelectionValue() {
    const val = this.input.value;
    if (this.delimiter === undefined) {
      return val;
    }
    const pos = this.input.selectionStart;
    if (pos === null) {
      return "";
    }
    const vals = val.split(this.delimiter);
    const idx = this.getSectionIndex(vals, pos, this.delimiter);
    return idx >= 0 ? vals[idx] : "";
  }

  private setSelectionValue(content: string, isContinuously = false) {
    let val = this.input.value;
    if (this.delimiter != undefined) {
      const pos = this.input.selectionStart;
      if (pos != null) {
        const vals = val.split(this.delimiter);
        const idx = this.getSectionIndex(vals, pos, this.delimiter);
        if (idx >= 0) {
          vals[idx] = content;
        }
        val = vals.join(this.delimiter);
      }
      if (isContinuously) {
        val += this.delimiter;
      }
    }
    else {
      val = content;
    }

    this.inputNode.val(val).change();
    if (isContinuously) {
      this.inputNode.focus();
    } else {
      this.inputNode.blur();
    }
  }

  getInstance() {
    return this.container;
  }

  private updateRecommendableList(content: string) {
    // 所以我为什么要在这里再写一遍几乎一样的逻辑...TwT
    if (!content && this.hideBeforeInput) {
      this.inputList.hide();
      return;
    }
    const recommendableList: InputRatedRecommendation[] = [];
    this.recommendationList.forEach(entry => {
      let matchScore;
      const value = entry.value;
      const pos = value.indexOf(content);
      if (pos < 0) matchScore = 0;
      else matchScore = pos === 0 ? 2 : 1;
      recommendableList.push(Object.assign(entry, { matchScore }));
    });
    this.selected = 0;
    this.renderRecommendationList(
      recommendableList
      .filter(e => e.matchScore)
      .sort((a, b) => a.matchScore! - b.matchScore!)
    );
  }

  private renderRecommendationList(recommendableList: InputRecommendation[]) {
    this.inputList.empty();
    recommendableList.forEach((entry, index) => {
      let html = entry.html ?? entry.value;
      if (entry.html != undefined && entry.showValue) {
        html += `&nbsp;<span class="item-ename">${ entry.value }</span>`;
      }
      $(`<a class="mcmodder-input-option" data-value="${ entry.value }" data-index="${ index }">`)
      .html(html)
      .appendTo(this.inputList);
    });
    this.listLength = recommendableList.length;

    if (this.onModifyRecommendation) {
      this.inputList.children(".mcmodder-input-option").each((_, e) => {
        $(`<a class="mcmodder-input-delete"><i class="fa fa-close" /></a>`).appendTo(e);
      });
      if (this.getSelectionValue()) {
        $(`<a class="mcmodder-input-option mcmodder-input-new" data-index=-1>`)
        .html(`<span class="mcmodder-slim-dark">+ 保存为快捷输入项</span>`)
        .appendTo(this.inputList);
      }
    }

    if (this.inputList.children().length) {
      this.inputList.show();
    } else {
      this.inputList.hide();
    }
  }

  private getOptionNode(index: number) {
    return this.inputList.find(`[data-index=${ index }]`);
  }

  private getSelectedOptionNode() {
    return this.getOptionNode(this.selected);
  }

  private updateSelection(index: number) {
    this.getOptionNode(this.selected).removeClass("selected");
    this.getOptionNode(index).addClass("selected");
    this.selected = index;
  }
}