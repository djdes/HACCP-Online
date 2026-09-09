import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { describe, it } from "node:test";

import { isStreamingBody } from "@/lib/streaming-body";

describe("isStreamingBody", () => {
  describe("потоку нужен duplex", () => {
    it("поток Node — именно такой отдаёт grammy для файла с диска", () => {
      assert.equal(isStreamingBody(Readable.from(["a"])), true);
    });

    it("web-поток", () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          controller.close();
        },
      });
      assert.equal(isStreamingBody(stream), true);
    });

    it("асинхронный генератор", () => {
      async function* gen() {
        yield new Uint8Array([1]);
      }
      assert.equal(isStreamingBody(gen()), true);
    });
  });

  describe("остальному duplex только мешает", () => {
    it("строка — так уходят обычные сообщения, и они работали", () => {
      assert.equal(isStreamingBody('{"chat_id":1}'), false);
    });

    it("буфер и типизированный массив", () => {
      assert.equal(isStreamingBody(Buffer.from("a")), false);
      assert.equal(isStreamingBody(new Uint8Array([1])), false);
      assert.equal(isStreamingBody(new ArrayBuffer(8)), false);
    });

    it("FormData и URLSearchParams undici собирает сам", () => {
      assert.equal(isStreamingBody(new FormData()), false);
      assert.equal(isStreamingBody(new URLSearchParams("a=1")), false);
    });

    it("Blob", () => {
      assert.equal(isStreamingBody(new Blob(["a"])), false);
    });

    it("тела нет вовсе", () => {
      assert.equal(isStreamingBody(undefined), false);
      assert.equal(isStreamingBody(null), false);
    });

    it("обычный объект — не поток", () => {
      assert.equal(isStreamingBody({ chat_id: 1 }), false);
    });
  });
});
