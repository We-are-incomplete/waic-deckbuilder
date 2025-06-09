import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
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
    expect(images[0].attributes("alt")).toBe("");
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

  it("カード情報は表示されない", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
        currentCard: testCard,
        cardIndex: 1,
        totalCards: 3,
      },
    });

    // カード名や位置情報は表示されない
    expect(wrapper.text()).not.toContain("テストカード");
    expect(wrapper.text()).not.toContain("2 / 3");
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
});
