/* 표기용 라벨 — 서버·클라이언트 양쪽에서 쓰므로 "use client" 파일에 두지 않는다.
   🚨 "use client" 모듈의 export는 전부 클라이언트 참조가 되어 서버에서 호출하면 터진다
      (실제로 카테고리 지면이 500이 났던 원인). 순수 함수는 이렇게 별도 모듈로 뺀다.

   데이터(카테고리명)는 한글 그대로 두고 **표시만** 영문으로 옮긴다.
   매핑에 없으면 원래 이름을 그대로 쓴다 — 운영자가 카테고리를 추가해도 깨지지 않는다 (FR-34). */

const EN: Record<string, string> = {
  문구: "STATIONERY",
  생활: "LIVING",
  패션: "FASHION",
  리빙: "INTERIOR",
  뷰티: "BEAUTY",
  테크: "TECH",
  푸드: "FOOD",
};

export const en = (name: string) => EN[name] ?? name;

export type NavCategory = { id: string; name: string };
