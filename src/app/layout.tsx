import type { Metadata } from "next";
import "./globals.css";
import "./datasets.css";
import "./learning.css";
import "./observatory.css";
import "./concepts.css";
import "./classification.css";
import "./exploration.css";
import "./illustrated.css";
import "./islands.css";
import "./polish.css";
import "./companion.css";
import "./island-learning.css";
import "./workspace.css";
import "./garden.css";
import "./planet.css";
import "./lab.css";

export const metadata: Metadata = {
  title: "模力星球 · 机器学习实验课堂",
  description: "亲手清洗数据、填写参数、训练模型，让每次选择都看见结果。",
  icons: {icon:"/brand/model-planet.svg"},
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
