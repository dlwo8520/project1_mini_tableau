import { createDataset } from "./engine";
export function sample(which: string) {
  if (which === "sales") {
    const matrix: unknown[][] = [
      ["날짜", "지역", "카테고리", "매출", "주문 수", "광고비"],
    ];
    const regions = ["서울", "부산", "대전", "제주"],
      cats = ["라이프스타일", "테크", "리빙"];
    for (let m = 0; m < 12; m++)
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 3; c++) {
          const orders = 38 + ((m * 17 + r * 11 + c * 23) % 72) + m * 3;
          matrix.push([
            `2025-${String(m + 1).padStart(2, "0")}-01`,
            regions[r],
            cats[c],
            orders * (21000 + c * 7500 + r * 2100),
            orders,
            Math.round(orders * (1400 + c * 220) * (1 + (m % 3) * 0.1)),
          ]);
        }
    const ds = createDataset("브랜드 매출 데이터", matrix);
    ds.notes = [
      "기능 체험을 위해 만든 가상 데이터입니다. 실제 사업 실적이 아닙니다.",
    ];
    return ds;
  }
  if (which === "city") {
    const matrix: unknown[][] = [
      ["날짜", "도시", "기온", "강수량", "미세먼지"],
    ];
    ["서울", "부산", "제주"].forEach((city, c) => {
      for (let d = 1; d <= 90; d++) {
        const date = new Date(Date.UTC(2025, 0, d)).toISOString().slice(0, 10);
        matrix.push([
          date,
          city,
          +(4 + c * 2 + Math.sin(d / 18) * 8 + d / 15).toFixed(1),
          d % 9 === 0 ? (d % 17) + 2 : 0,
          Math.round(25 + Math.sin(d / 6 + c) * 15),
        ]);
      }
    });
    const ds = createDataset("도시 환경 데이터", matrix);
    ds.notes = ["가상 환경 데이터입니다. 실제 관측값이 아닙니다."];
    return ds;
  }
  const matrix: unknown[][] = [
    ["응답 ID", "연령대", "유입 경로", "만족도", "이용 시간", "의견"],
  ];
  for (let i = 0; i < 180; i++)
    matrix.push([
      `U${String(i + 1).padStart(4, "0")}`,
      ["20대", "30대", "40대", "50대"][i % 4],
      ["검색", "SNS", "지인 추천"][i % 3],
      i % 19 === 0 ? null : 3 + (i % 3),
      10 + ((i * 7) % 95),
      i % 13 === 0 ? "  편리해요  " : i % 5 === 0 ? null : "다시 사용할게요",
    ]);
  matrix.push([...matrix[12]], [...matrix[48]]);
  const ds = createDataset("사용자 설문 데이터", matrix);
  ds.notes = [
    "가상 설문입니다. 빈 값·중복·공백이 있어 전처리를 연습할 수 있습니다.",
  ];
  return ds;
}
