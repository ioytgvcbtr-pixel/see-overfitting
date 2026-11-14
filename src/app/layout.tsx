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

export const metadata: Metadata = {
  title: "看见过拟合 · FitLab 交互实验室",
  description: "先预测，再实验，用新数据验证理解；让AI建议接受真实计算的检验。",
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
