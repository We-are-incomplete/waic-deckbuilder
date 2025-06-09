import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import CardImageModal from "./CardImageModal.vue";

describe("CardImageModal", () => {
  beforeEach(() => {
    // キーボードイベントリスナーをモック
    vi.spyOn(document, "addEventListener");
  });

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

  it("×ボタンが表示されない", () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image.jpg",
      },
    });

    const closeButton = wrapper.find("button");
    expect(closeButton.exists()).toBe(false);
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

    const imageContainer = wrapper.find(".relative.max-w-\\[98vw\\]");
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

  it("imageSrcが変更されたとき、imageLoadedがリセットされる", async () => {
    const wrapper = mount(CardImageModal, {
      props: {
        isVisible: true,
        imageSrc: "test-image1.jpg",
      },
    });

    // 最初の画像のロードをシミュレート（非表示の画像でloadイベントを発火）
    const images = wrapper.findAll("img");
    if (images.length > 0) {
      await images[images.length - 1].trigger("load"); // 最後の画像（非表示の画像）
    }
    await wrapper.vm.$nextTick();

    // ローディング表示が消えていることを確認
    expect(wrapper.find(".animate-spin").exists()).toBe(false);

    // imageSrcを変更
    await wrapper.setProps({ imageSrc: "test-image2.jpg" });
    await wrapper.vm.$nextTick();

    // ローディング表示が再び表示されることを確認
    expect(wrapper.find(".animate-spin").exists()).toBe(true);
  });
});
