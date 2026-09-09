import { buildBarLineAreaOption, buildDoughnutFunnelOption, chartNumber } from "./chart-options";

const rows = [{ x: "A", y: "1,200" }, { x: "B", y: 800 }];
const types = ["vertical_bar_chart", "horizontal_bar_chart", "line", "area_chart"];
for (const type of types) {
  const option = buildBarLineAreaOption(type, rows, {});
  if (!Array.isArray(option.series) || option.series.length !== 1) throw new Error(`${type}: missing series`);
  if (option.series[0].data[0] !== 1200) throw new Error(`${type}: formatted number was not normalized`);
}
for (const type of ["doughnut", "funnel"]) {
  const option = buildDoughnutFunnelOption(type, rows);
  const expected = type === "funnel" ? "funnel" : "pie";
  if (option.series[0].type !== expected) throw new Error(`${type}: wrong series type`);
}
if (chartNumber("(1,234.50)") !== -1234.5) throw new Error("accounting number was not normalized");
console.log("chart-options.test.ts: all checks passed");
