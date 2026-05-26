import { getSupabaseClient } from "../integration/supabase";
import { Mcmodder } from "../Mcmodder";
import { unsafeWindow } from "$";

declare const swal: any;
declare const Swal: any;

const getSwal = (): any => {
  if (typeof swal !== "undefined") return swal;
  if (typeof Swal !== "undefined") return Swal;
  if (typeof unsafeWindow !== "undefined" && (unsafeWindow as any).swal) return (unsafeWindow as any).swal;
  if (typeof unsafeWindow !== "undefined" && (unsafeWindow as any).Swal) return (unsafeWindow as any).Swal;
  if ((window as any).swal) return (window as any).swal;
  if ((window as any).Swal) return (window as any).Swal;
  return null;
};

export class CommentAttitudeSystem {
  static readonly ATTITUDE_TYPE = "devil-angry";
  static readonly ATTITUDE_TITLE = "恶魔安格瑞";
  static readonly ICON_SVG = `<svg viewBox="0 0 512 512" style="width: 1em; height: 1em; fill: currentColor; display: inline-block; vertical-align: middle;" class="svg-inline--fa"><g transform="translate(51, 90) scale(0.8)"><path d="M512 256C512 397.4 397.4 512 256 512C114.6 512 0 397.4 0 256C0 114.6 114.6 0 256 0C397.4 0 512 114.6 512 256zM339.9 373.3C323.8 355.4 295.7 336 256 336C216.3 336 188.2 355.4 172.1 373.3C166.2 379.9 166.7 389.1 173.3 395.9C179.9 401.8 189.1 401.3 195.9 394.7C207.6 381.7 227.5 368 255.1 368C284.5 368 304.4 381.7 316.1 394.7C322 401.3 332.1 401.8 338.7 395.9C345.3 389.1 345.8 379.9 339.9 373.3H339.9zM176.4 272C194 272 208.4 257.7 208.4 240C208.4 238.5 208.3 237 208.1 235.6L218.9 239.2C227.3 241.1 236.4 237.4 239.2 229.1C241.1 220.7 237.4 211.6 229.1 208.8L133.1 176.8C124.7 174 115.6 178.6 112.8 186.9C110 195.3 114.6 204.4 122.9 207.2L153.7 217.4C147.9 223.2 144.4 231.2 144.4 240C144.4 257.7 158.7 272 176.4 272zM358.9 217.2L389.1 207.2C397.4 204.4 401.1 195.3 399.2 186.9C396.4 178.6 387.3 174 378.9 176.8L282.9 208.8C274.6 211.6 270 220.7 272.8 229.1C275.6 237.4 284.7 241.1 293.1 239.2L304.7 235.3C304.5 236.8 304.4 238.4 304.4 240C304.4 257.7 318.7 272 336.4 272C354 272 368.4 257.7 368.4 240C368.4 231.1 364.7 223 358.9 217.2H358.9z"/></g><path d="M110 120 C90 60, 40 50, 20 40 C60 90, 110 110, 130 140 Z" /><path d="M402 120 C422 60, 472 50, 492 40 C452 90, 402 110, 382 140 Z" /></svg>`;

  static userVotedCommentIds: Set<string> = new Set();
  private static isEventBound = false;

  static processElements($context: JQuery) {
    $context.find(".comment-attitude-list-hover ul").each((_, ul) => {
      const $ul = $(ul);
      if ($ul.find(".devil-angry").length === 0) {
        $ul.append(`<li><a title="${CommentAttitudeSystem.ATTITUDE_TITLE}" href="javascript:void(0);" class="comment-attitude devil-angry" data-type="${CommentAttitudeSystem.ATTITUDE_TYPE}">${CommentAttitudeSystem.ICON_SVG}</a></li>`);
      }
    });

    $context.find(".comment-attitude-result").each((_, ol) => {
      const $ol = $(ol);
      if ($ol.find(".devil-angry").length === 0) {
        $ol.append(`<li title="${CommentAttitudeSystem.ATTITUDE_TITLE}" style="display:none;"><a href="javascript:void(0);" class="comment-attitude devil-angry" data-type="${CommentAttitudeSystem.ATTITUDE_TYPE}">${CommentAttitudeSystem.ICON_SVG}<span>0</span></a></li>`);
      }
    });
  }

  static async fetchAttitudeCounts(parent: Mcmodder) {
    const client = getSupabaseClient();
    if (!client) return;

    const commentIds: string[] = [];
    $(".comment-row, .comment-reply-row").each((_, row) => {
      const cid = $(row).find("input.comment-id").val() as string;
      if (cid && !commentIds.includes(cid)) {
        commentIds.push(cid);
      }
    });

    if (commentIds.length === 0) return;

    try {
      const { data: attitudes, error } = await client
        .from("mcmodder_attitudes")
        .select("comment_id, from_uid")
        .in("comment_id", commentIds)
        .eq("attitude_type", CommentAttitudeSystem.ATTITUDE_TYPE);

      if (error) throw error;
      if (!attitudes) return;

      const countMap: Record<string, number> = {};
      attitudes.forEach((item) => {
        countMap[item.comment_id] = (countMap[item.comment_id] || 0) + 1;
        if (item.from_uid === parent.currentUID) {
          CommentAttitudeSystem.userVotedCommentIds.add(item.comment_id);
        }
      });

      $(".comment-row, .comment-reply-row").each((_, row) => {
        const $row = $(row);
        const cid = $row.find("input.comment-id").val() as string;
        if (cid && countMap[cid] !== undefined) {
          const count = countMap[cid];
          const $resultLi = $row.find(".comment-attitude-result li[title='" + CommentAttitudeSystem.ATTITUDE_TITLE + "']");
          $resultLi.find("span").text(count);
          $resultLi.show();

          if (CommentAttitudeSystem.userVotedCommentIds.has(cid)) {
            $resultLi.find("a").addClass("colourful");
          }
        }
      });
    } catch (err) {
      console.error(err);
    }
  }

  static async checkNotifications(parent: Mcmodder) {
    const client = getSupabaseClient();
    if (!client || !parent.currentUID) return;

    try {
      const { data: records, error } = await client
        .from("mcmodder_attitudes")
        .select("id, from_uid, from_username, from_avatar, source_url, comment_text, created_at")
        .eq("to_uid", parent.currentUID)
        .eq("is_read", false)
        .eq("attitude_type", CommentAttitudeSystem.ATTITUDE_TYPE);

      if (error) throw error;
      if (!records || records.length === 0) return;

      let notifyHtml = `<div class="mcmodder-notification-center" style="max-height: 400px; overflow-y: auto;">`;
      notifyHtml += `<ul class="center-content admin-list" style="list-style: none; padding-left: 0; margin: 0;">`;
      records.forEach((item) => {
        const avatarUrl = item.from_avatar || "https://www.mcmod.cn/static/public/images/avatar_none.png";
        const linkUrl = item.source_url || `https://center.mcmod.cn/${item.from_uid}/`;
        const summary = item.comment_text
          ? item.comment_text.length > 30
            ? item.comment_text.slice(0, 30) + "..."
            : item.comment_text
          : "查看短评";
        const formattedTime = item.created_at ? new Date(item.created_at).toLocaleString() : "";
        notifyHtml += `
          <li style="display: flex; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--mcmodder-color-background-dark2); padding-bottom: 12px; align-items: flex-start; text-align: left;">
            <span class="avatar" style="width: 48px; height: 48px; flex-shrink: 0; display: inline-block;">
              <a href="//center.mcmod.cn/${item.from_uid}/" target="_blank">
                <img alt="${item.from_username}" src="${avatarUrl}" style="width: 100%; height: 100%; border-radius: 50%;">
              </a>
            </span>
            <span class="info" style="flex-grow: 1;">
              <span class="username" style="font-size: 14px; display: block; margin-bottom: 4px;">
                <b><a href="//center.mcmod.cn/${item.from_uid}/" target="_blank">${item.from_username}</a></b>
                表示很
                <span class="badge badge-light content-comment-attitude" style="border: 1px solid var(--mcmodder-color-background-dark3); font-weight: normal; font-size: 12px; padding: 2px 6px;">
                  ${CommentAttitudeSystem.ICON_SVG}
                  ${CommentAttitudeSystem.ATTITUDE_TITLE}
                </span>
              </span>
              <span class="content-reply bd-callout text-muted" style="display: block; font-size: 13px; margin: 6px 0; padding: 6px 12px; background-color: var(--mcmodder-color-background-dark1); border-left: 3px solid var(--mcmodder-color-primary-transparent2); border-radius: 4px;">
                <a href="${linkUrl}" target="_blank" style="color: var(--mcmodder-color-link); text-decoration: none;">${summary}</a>
              </span>
              <ul class="content-tools" style="margin: 0; padding: 0; list-style: none;">
                <li class="text-muted" style="font-size: 11px; color: var(--mcmodder-color-text-dark3);">${formattedTime}</li>
              </ul>
            </span>
            <span class="content-ground"><span class="text-muted"></span></span>
          </li>
        `;
      });
      notifyHtml += `</ul></div>`;

      getSwal()?.fire({
        title: "表态通知",
        html: notifyHtml,
        confirmButtonText: "我知道了",
        confirmButtonColor: "var(--mcmodder-color-primary)",
        allowOutsideClick: false
      }).then(async () => {
        const recordIds = records.map((r) => r.id);
        await client
          .from("mcmodder_attitudes")
          .update({ is_read: true })
          .in("id", recordIds);
      });
    } catch (err) {
      console.error(err);
    }
  }

  static bindEvents(parent: Mcmodder) {
    if (CommentAttitudeSystem.isEventBound) return;
    CommentAttitudeSystem.isEventBound = true;

    document.addEventListener("click", async function (e) {
      const target = e.target as HTMLElement;
      const $btn = $(target).closest(".comment-attitude.devil-angry");
      if ($btn.length === 0) return;

      e.stopImmediatePropagation();
      e.preventDefault();

      const client = getSupabaseClient();
      if (!client) {
        getSwal()?.fire({
          title: "无法使用表态",
          text: "自定义表态服务暂时不可用，请稍后重试或检查您的网络！",
          icon: "warning",
          confirmButtonText: "好"
        });
        return;
      }

      const currentUID = parent.currentUID;
      if (!currentUID) {
        getSwal()?.fire({
          title: "未登录",
          text: "请先登录 MC 百科账号！",
          icon: "warning",
          confirmButtonText: "好"
        });
        return;
      }

      const $tools = $btn.closest(".comment-tools");
      const commentId = $tools.find("input.comment-id").val() as string;
      if (!commentId) return;

      const $commentContainer = $btn.closest(".comment-row, .comment-reply-row");
      const $authorLink = $commentContainer.find(".comment-row-username li a.poped, .comment-reply-row-username a.poped").first();
      const toUID = Number($authorLink.attr("data-uid")) || 0;
      const toUsername = $authorLink.text().trim();
      const commentText = $commentContainer.find(".comment-row-text-content, .comment-reply-row-text-content").first().text().trim();

      if (toUID === currentUID) {
        getSwal()?.fire({
          title: "表态失败",
          text: "不能给自己发表的短评进行表态哦~",
          icon: "info",
          confirmButtonText: "好"
        });
        return;
      }

      const isVoted = CommentAttitudeSystem.userVotedCommentIds.has(commentId);

      try {
        if (isVoted) {
          const { error } = await client
            .from("mcmodder_attitudes")
            .delete()
            .eq("comment_id", commentId)
            .eq("from_uid", currentUID);

          if (error) {
            throw error;
          }

          CommentAttitudeSystem.userVotedCommentIds.delete(commentId);

          const $resultLi = $tools.find(".comment-attitude-result li[title='" + CommentAttitudeSystem.ATTITUDE_TITLE + "']");
          const $span = $resultLi.find("span");
          const newCount = Math.max(0, (Number($span.text()) || 0) - 1);
          $span.text(newCount);
          if (newCount === 0) {
            $resultLi.hide();
          }
          $tools.find(".comment-attitude.devil-angry").removeClass("colourful");
        } else {
          const { data: existRecords } = await client
            .from("mcmodder_attitudes")
            .select("id")
            .eq("comment_id", commentId)
            .eq("from_uid", currentUID)
            .limit(1);

          if (existRecords && existRecords.length > 0) {
            CommentAttitudeSystem.userVotedCommentIds.add(commentId);
            $tools.find(".comment-attitude.devil-angry").addClass("colourful");
            return;
          }

          const fromAvatar = parent.utils.getAllProfile(currentUID).avatar || $(".header-user-avatar img, .name.top-username img, .profilebox img").first().attr("src") || "";
          const sourceUrl = window.location.href.split("#")[0] + "#comment-" + commentId;

          const { error } = await client
            .from("mcmodder_attitudes")
            .insert({
              comment_id: commentId,
              comment_text: commentText.slice(0, 100),
              from_uid: currentUID,
              from_username: parent.currentUsername || "匿名用户",
              from_avatar: fromAvatar,
              to_uid: toUID,
              to_username: toUsername,
              attitude_type: CommentAttitudeSystem.ATTITUDE_TYPE,
              is_read: false,
              source_url: sourceUrl
            });

          if (error) {
            throw error;
          }

          CommentAttitudeSystem.userVotedCommentIds.add(commentId);

          const $resultLi = $tools.find(".comment-attitude-result li[title='" + CommentAttitudeSystem.ATTITUDE_TITLE + "']");
          const $span = $resultLi.find("span");
          const newCount = (Number($span.text()) || 0) + 1;
          $span.text(newCount);
          $resultLi.show();
          $tools.find(".comment-attitude.devil-angry").addClass("colourful");
        }
      } catch (err) {
        console.error(err);
        getSwal()?.fire({
          title: "操作失败",
          text: "表态存储失败，请稍后重试或检查 Supabase 连接！",
          icon: "error",
          confirmButtonText: "好"
        });
      }
    }, true);
  }
}
