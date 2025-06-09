import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import CardImageModal from "./CardImageModal.vue";
import type { Card } from "../../types";

describe("CardImageModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const testCard: Card = {
    id: "test-card-1",
    name: "テストカード",
    kind: "Song",
    type: "赤",
  };

  it("isVisibleがfalseの場合、モーダルが表示されない", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: false,
        imageSrc: "test-image.jpg",
      },
    });

    expect(wrapper.find(".fixed.inset-0").exists()).toBe(false);
  });

  it("isVisibleがtrueの場合、モーダルが表示される", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
      },
    });

    expect(wrapper.find(".fixed.inset-0").exists()).toBe(true);
  });

  it("ナビゲーションボタンが表示されない", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
        currentCard: testCard,
        cardIndex: 1,
        totalCards: 3,
      },
    });

    // ナビゲーションボタンは表示されない
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(0);
  });

  it("モーダル背景（画面外）をクリックするとcloseイベントが発火される", async () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
      },
    });

    const modalBackground = wrapper.find(".fixed.inset-0");
    await modalBackground.trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("画像コンテナをクリックしてもcloseイベントが発火されない", async () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
      },
    });

    const imageContainer = wrapper.find(".max-w-\\[98vw\\]");
    await imageContainer.trigger("click");

    expect(wrapper.emitted("close")).toBeFalsy();
  });

  it("画像が提供された場合、画像が表示される", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
      },
    });

    const images = wrapper.findAll("img");
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].attributes("src")).toBe("test-image.jpg");
    expect(images[0].attributes("alt")).toBe("カードの詳細画像");
  });

  it("currentCardが提供された場合、alt属性にカード名が表示される", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
        currentCard: testCard,
      },
    });

    const images = wrapper.findAll("img");
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].attributes("alt")).toBe("テストカードの詳細画像");
  });

  it("imageSrcがnullの場合、画像が表示されない", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: null,
      },
    });

    const images = wrapper.findAll("img");
    expect(images.length).toBe(0);
  });

  it("アクセシビリティのための画面読み上げソフト用情報が含まれる", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
        currentCard: testCard,
        cardIndex: 1,
        totalCards: 3,
      },
    });

    // 画面読み上げソフト用の見出しが存在する
    const heading = wrapper.find("h2#modal-title");
    expect(heading.exists()).toBe(true);
    expect(heading.text()).toBe("テストカードの詳細画像 (2/3)");
    expect(heading.classes()).toContain("sr-only");
  });

  it("タッチイベントが適切に設定されている", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
        currentCard: testCard,
        cardIndex: 1,
        totalCards: 3,
      },
    });

    const touchContainer = wrapper.find(".touch-pan-y");
    expect(touchContainer.exists()).toBe(true);
  });

  it("アクセシビリティ属性が適切に設定されている", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
        currentCard: testCard,
      },
    });

    const modal = wrapper.find(".fixed.inset-0");
    expect(modal.attributes("role")).toBe("dialog");
    expect(modal.attributes("aria-modal")).toBe("true");
    expect(modal.attributes("aria-labelledby")).toBe("modal-title");

    const modalContent = wrapper.find(".max-w-\\[98vw\\]");
    expect(modalContent.attributes("tabindex")).toBe("-1");
  });

  it("Escapeキーでモーダルが閉じられる", async () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
      },
    });

    const modal = wrapper.find(".fixed.inset-0");
    await modal.trigger("keydown", { key: "Escape" });

    expect(wrapper.emitted("close")).toBeTruthy();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  describe("画像読み込み中状態", () => {
    it("imageSrcが変更されると、ローディング状態が開始される", async () => {
      const wrapper = mount(CardImageModal, {
        props: {
          isVisible: true,
          imageSrc: null,
        },
      });

      // 初期状態ではローディング表示なし
      expect(wrapper.find(".animate-spin").exists()).toBe(false);

      // imageSrcを設定
      await wrapper.setProps({ imageSrc: "test-image.jpg" });
      await nextTick();

      // ローディングスピナーが表示される
      expect(wrapper.find(".animate-spin").exists()).toBe(true);
    });

    it("画像のloadイベントでローディング状態が終了される", async () => {
      const wrapper = mount(CardImageModal, {
        props: {
          isVisible: true,
          imageSrc: null,
        },
      });

      await nextTick();

      // 初期状態ではローディング表示なし
      expect(wrapper.find(".animate-spin").exists()).toBe(false);

      // imageSrcを設定してローディング開始
      await wrapper.setProps({ imageSrc: "test-image.jpg" });
      await nextTick();

      // ローディング表示あり
      expect(wrapper.find(".animate-spin").exists()).toBe(true);

      // 画像のloadイベントを発火
      const image = wrapper.find("img");
      await image.trigger("load");

      // ローディングスピナーが非表示になる
      expect(wrapper.find(".animate-spin").exists()).toBe(false);
    });

    it("imageSrcがnullの場合、ローディング表示されない", async () => {
      const wrapper = mount(CardImageModal, {
        props: {
          isVisible: true,
          imageSrc: null,
        },
      });

      await nextTick();

      // ローディングスピナーは表示されない
      expect(wrapper.find(".animate-spin").exists()).toBe(false);
    });

    it("imageSrcが空文字の場合、ローディング表示されない", async () => {
      const wrapper = mount(CardImageModal, {
        props: {
          isVisible: true,
          imageSrc: "",
        },
      });

      await nextTick();

      // ローディングスピナーは表示されない
      expect(wrapper.find(".animate-spin").exists()).toBe(false);
    });

    it("異なるimageSrcに変更すると、再度ローディング状態になる", async () => {
      const wrapper = mount(CardImageModal, {
        props: {
          isVisible: true,
          imageSrc: "test-image-1.jpg",
        },
      });

      await nextTick();

      // 初期画像のloadイベントを発火してローディング完了
      const image = wrapper.find("img");
      await image.trigger("load");
      expect(wrapper.find(".animate-spin").exists()).toBe(false);

      // 別の画像に変更
      await wrapper.setProps({ imageSrc: "test-image-2.jpg" });
      await nextTick();

      // 再度ローディング状態になる
      expect(wrapper.find(".animate-spin").exists()).toBe(true);
    });
  });
});
