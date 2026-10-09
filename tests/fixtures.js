import { newKit, newPaint } from "../src/domain.js";
export const paint = (id = "white") => ({
  ...newPaint(),
  id,
  name: id === "white" ? "クールホワイト" : "ニュートラルグレー",
  manufacturer: "GSIクレオス",
  color: "白",
  type: "ラッカー",
  bottles: [{ id: "bottle-1", label: "瓶1", remainingPercent: 80 }],
});
export function kit() {
  return {
    ...newKit(),
    name: "RG νガンダム",
    runners: [
      {
        id: "runner-a",
        symbol: "A",
        memo: "",
        colors: [
          { id: "red", name: "赤" },
          { id: "yellow", name: "黄" },
          { id: "black", name: "黒" },
        ],
      },
    ],
    groups: [
      {
        id: "group-1",
        name: "ホワイト",
        resultColor: "白",
        memo: "",
        targets: [{ runnerId: "runner-a", colorId: "red" }],
        processes: [
          {
            id: "process-1",
            name: "本色",
            type: "本色",
            method: "エアブラシ",
            memo: "",
            paintUsages: [
              { paintId: "white", ratioTenths: 700 },
              { paintId: "gray", ratioTenths: 300 },
            ],
          },
        ],
      },
    ],
  };
}
export const paints = () => [paint(), paint("gray")];
